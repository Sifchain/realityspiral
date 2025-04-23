import { elizaLogger } from "@elizaos/core";
import type { ContractHelper } from "@realityspiral/plugin-coinbase";
import { ethers } from "ethers";
import {
	ABIS,
	POOL_FEES,
	SAPPHIRE_MAINNET,
	SAPPHIRE_TESTNET,
} from "../constants";
import { UNISWAP_V3_POOL_ABI, UNISWAP_V3_QUOTER_ABI } from "../constants";
import type { ArbitrageOpportunity, PriceInfo } from "../types";
import type { PluginConfig } from "../types";
import { ENDPOINTS, sortTokens } from "./utils";
import { getProvider } from "./utils";

/**
 * Service for monitoring prices and finding arbitrage opportunities
 */
export class PriceService {
	private contractHelper: ContractHelper;
	private networkId: string;
	private quoterAddress: string;
	private factoryAddress: string;

	constructor(
		contractHelper: ContractHelper,
		networkId: string,
		quoterAddress: string,
		factoryAddress: string,
	) {
		this.contractHelper = contractHelper;
		this.networkId = networkId;
		this.quoterAddress = quoterAddress;
		this.factoryAddress = factoryAddress;
	}

	/**
	 * Get price for a token pair
	 */
	async getPrice(
		tokenA: string,
		tokenB: string,
		fee: number = POOL_FEES.MEDIUM,
	): Promise<string> {
		try {
			elizaLogger.info("Getting price for token pair", { tokenA, tokenB, fee });

			// For price quotes, we use the smallest possible amount (1 wei) to minimize price impact
			const amountIn = "1";

			// Try to get price quote
			const amountOut = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: this.quoterAddress,
				method: "quoteExactInputSingle",
				args: [
					tokenA,
					tokenB,
					fee,
					amountIn,
					0, // No price limit
				],
				abi: ABIS.QUOTER,
			});

			return amountOut.toString();
		} catch (error) {
			elizaLogger.error("Failed to get price", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw new Error(
				`Failed to get price: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Monitor prices for common token pairs
	 */

	async monitorPrices(
		tokenPairs?: Array<[string, string]>,
	): Promise<PriceInfo[]> {
		try {
			// Get network configuration to use proper token addresses
			const networkConfig =
				this.networkId === "23294" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;

			// If no token pairs provided, use a default list of common pairs
			const pairs =
				tokenPairs ||
				[
					// Standard pairs with ROSE (native token)
					[networkConfig.TOKENS.ROSE, networkConfig.TOKENS.USDC],
					[networkConfig.TOKENS.ROSE, networkConfig.TOKENS.WETH],
					// USDC pairs
					[networkConfig.TOKENS.USDC, networkConfig.TOKENS.WETH],
					[networkConfig.TOKENS.USDC, networkConfig.TOKENS.WBTC],
					// Other common pairs
					[networkConfig.TOKENS.WETH, networkConfig.TOKENS.WBTC],
				].filter(([tokenA, tokenB]) => tokenA && tokenB && tokenA !== tokenB);

			if (pairs.length === 0) {
				elizaLogger.warn("No valid token pairs provided for price monitoring");
				return [];
			}

			elizaLogger.info("Monitoring prices for token pairs", {
				count: pairs.length,
				pairs: pairs.map(([a, b]) => `${a.slice(0, 8)}...${b.slice(0, 8)}...`),
			});

			const priceInfos: PriceInfo[] = [];

			// Get prices for each pair
			for (const [tokenA, tokenB] of pairs) {
				try {
					// Check different fee tiers
					for (const fee of [POOL_FEES.LOW, POOL_FEES.MEDIUM, POOL_FEES.HIGH]) {
						try {
							const price = await this.getPrice(tokenA, tokenB, fee);

							priceInfos.push({
								tokenA,
								tokenB,
								poolFee: fee,
								price,
								updatedAt: Date.now(),
							});
						} catch (_error) {
							// Skip this fee tier if there's an error (likely pool doesn't exist)
							elizaLogger.debug("Pool not found or error for fee tier", {
								tokenA,
								tokenB,
								fee,
							});
						}
					}
				} catch (error) {
					elizaLogger.error("Error monitoring prices for pair", {
						tokenA,
						tokenB,
						error:
							error instanceof Error
								? {
										message: error.message,
										stack: error.stack,
										name: error.name,
									}
								: error,
					});
					// Continue with other pairs
				}
			}

			return priceInfos;
		} catch (error) {
			elizaLogger.error("Failed to monitor prices", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return [];
		}
	}

	/**
	 * Helper function to get human-readable fee tier description
	 */
	private getFeeDescription(fee: number): string {
		switch (fee) {
			case POOL_FEES.LOWEST:
				return "0.01%";
			case POOL_FEES.LOW:
				return "0.05%";
			case POOL_FEES.MEDIUM:
				return "0.3%";
			case POOL_FEES.HIGH:
				return "1%";
			default:
				return `${fee / 10000}%`;
		}
	}

	/**
	 * Find arbitrage opportunities across pools
	 */

	async findArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
		try {
			elizaLogger.info("Finding arbitrage opportunities");

			// Get network configuration to use proper token addresses
			const networkConfig =
				this.networkId === "23294" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;

			// Common token pairs to check for arbitrage
			const tokenPairs = [
				// Standard pairs with ROSE (native token)
				[networkConfig.TOKENS.ROSE, networkConfig.TOKENS.USDC],
				[networkConfig.TOKENS.ROSE, networkConfig.TOKENS.WETH],
				// USDC pairs
				[networkConfig.TOKENS.USDC, networkConfig.TOKENS.WETH],
				[networkConfig.TOKENS.USDC, networkConfig.TOKENS.WBTC],
				// Other common pairs
				[networkConfig.TOKENS.WETH, networkConfig.TOKENS.WBTC],
			].filter(([tokenA, tokenB]) => tokenA && tokenB && tokenA !== tokenB);

			const opportunities: ArbitrageOpportunity[] = [];

			// Check for arbitrage between fee tiers
			for (const [tokenA, tokenB] of tokenPairs) {
				try {
					// Get prices for all fee tiers
					const feeTierPrices: { fee: number; price: bigint }[] = [];

					for (const fee of [
						POOL_FEES.LOWEST,
						POOL_FEES.LOW,
						POOL_FEES.MEDIUM,
						POOL_FEES.HIGH,
					]) {
						try {
							const priceStr = await this.getPrice(tokenA, tokenB, fee);
							if (priceStr && priceStr !== "0") {
								feeTierPrices.push({
									fee,
									price: BigInt(priceStr),
								});
							}
						} catch (_error) {
							// Pool probably doesn't exist for this fee tier, skip
						}
					}

					// Need at least 2 pools to compare
					if (feeTierPrices.length < 2) {
						continue;
					}

					// Find the min and max prices to calculate arbitrage opportunity
					let minPrice = feeTierPrices[0].price;
					let maxPrice = feeTierPrices[0].price;
					let minFeeTier = feeTierPrices[0].fee;
					let maxFeeTier = feeTierPrices[0].fee;

					for (const { fee, price } of feeTierPrices) {
						if (price < minPrice) {
							minPrice = price;
							minFeeTier = fee;
						}

						if (price > maxPrice) {
							maxPrice = price;
							maxFeeTier = fee;
						}
					}

					// Check if there's a meaningful arbitrage opportunity
					// Calculate as percentage difference
					const priceDiff = ((maxPrice - minPrice) * BigInt(10000)) / minPrice;

					// Calculate transaction costs (gas + fee)
					// 0.05% for low fee tier is 50 basis points
					const feeCost = BigInt(Math.min(minFeeTier, maxFeeTier));

					// Only consider significant arbitrage opportunities (>0.1% after fees)
					// and exclude false positives from calculation artifacts
					if (priceDiff > feeCost + BigInt(10)) {
						// 10 basis points (0.1%) above fees
						// Calculate confidence based on price difference
						let confidence: "low" | "medium" | "high" = "low";
						if (priceDiff > feeCost + BigInt(100)) {
							// >1% after fees
							confidence = "high";
						} else if (priceDiff > feeCost + BigInt(30)) {
							// >0.3% after fees
							confidence = "medium";
						}

						// Get token symbols for better description
						const tokenASymbol =
							tokenA === networkConfig.TOKENS.ROSE
								? "ROSE"
								: tokenA === networkConfig.TOKENS.USDC
									? "USDC"
									: tokenA === networkConfig.TOKENS.WETH
										? "WETH"
										: tokenA === networkConfig.TOKENS.WBTC
											? "WBTC"
											: tokenA.slice(0, 8);

						const tokenBSymbol =
							tokenB === networkConfig.TOKENS.ROSE
								? "ROSE"
								: tokenB === networkConfig.TOKENS.USDC
									? "USDC"
									: tokenB === networkConfig.TOKENS.WETH
										? "WETH"
										: tokenB === networkConfig.TOKENS.WBTC
											? "WBTC"
											: tokenB.slice(0, 8);

						// Determine which token to use as profit denominator
						const isProfitInA =
							tokenA === networkConfig.TOKENS.USDC ||
							tokenA === networkConfig.TOKENS.ROSE;
						const profitToken = isProfitInA ? tokenASymbol : tokenBSymbol;

						// Calculate estimated profit for 1 unit of the base token
						// This is a simplified calculation; real calculations should account for slippage
						const estimatedProfit =
							((priceDiff - feeCost) * BigInt(100)) / BigInt(10000);

						opportunities.push({
							routeDescription: `${tokenASymbol}/${tokenBSymbol}: Buy on ${this.getFeeDescription(minFeeTier)} pool, sell on ${this.getFeeDescription(maxFeeTier)} pool`,
							profitToken,
							estimatedProfit: estimatedProfit.toString(),
							confidence,
						});
					}
				} catch (error: unknown) {
					elizaLogger.error("Error checking arbitrage for pair", {
						tokenA,
						tokenB,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			return opportunities;
		} catch (error: unknown) {
			elizaLogger.error("Failed to find arbitrage opportunities", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return [];
		}
	}

	/**
	 * Get detailed pool information
	 */
	async getPoolInfo(
		tokenA: string,
		tokenB: string,
		fee: number = POOL_FEES.MEDIUM,
	): Promise<Record<string, unknown>> {
		try {
			elizaLogger.info("Getting pool information", { tokenA, tokenB, fee });

			// Sort tokens to match pool creation order
			const [token0, token1] = sortTokens(tokenA, tokenB);

			// Get pool address
			const poolAddress = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: this.factoryAddress,
				method: "getPool",
				args: [token0, token1, fee],
				abi: ABIS.V3_CORE_FACTORY,
			});

			if (!poolAddress) {
				throw new Error("Pool not found");
			}

			// Get pool slots (contains liquidity, last observation, etc.)
			const slot0 = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: poolAddress,
				method: "slot0",
				args: [],
				abi: [
					{
						constant: true,
						inputs: [],
						name: "slot0",
						outputs: [
							{ name: "sqrtPriceX96", type: "uint160" },
							{ name: "tick", type: "int24" },
							{ name: "observationIndex", type: "uint16" },
							{ name: "observationCardinality", type: "uint16" },
							{ name: "observationCardinalityNext", type: "uint16" },
							{ name: "feeProtocol", type: "uint8" },
							{ name: "unlocked", type: "bool" },
						],
						type: "function",
					},
				],
			});

			// Get liquidity
			const liquidity = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: poolAddress,
				method: "liquidity",
				args: [],
				abi: [
					{
						constant: true,
						inputs: [],
						name: "liquidity",
						outputs: [{ name: "", type: "uint128" }],
						type: "function",
					},
				],
			});

			// Return compiled pool info
			return {
				address: poolAddress,
				token0,
				token1,
				fee,
				sqrtPriceX96: slot0.sqrtPriceX96.toString(),
				tick: slot0.tick,
				liquidity: liquidity.toString(),
				unlocked: slot0.unlocked,
			};
		} catch (error) {
			elizaLogger.error("Failed to get pool info", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw new Error(
				`Failed to get pool info: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}

// USDC address - commonly used as price reference
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

/**
 * Gets the current price of a token relative to another token (usually USDC)
 */
export async function getTokenPrice(
	tokenAddress: string,
	config: PluginConfig,
	logger: typeof elizaLogger,
	baseTokenAddress: string = USDC_ADDRESS,
): Promise<PriceInfo> {
	logger.debug("Getting token price", { tokenAddress, baseTokenAddress });

	try {
		const provider = getProvider(config);

		// Get token details
		const tokenContract = new ethers.Contract(
			tokenAddress,
			[
				"function decimals() view returns (uint8)",
				"function symbol() view returns (string)",
			],
			provider,
		);

		const baseTokenContract = new ethers.Contract(
			baseTokenAddress,
			[
				"function decimals() view returns (uint8)",
				"function symbol() view returns (string)",
			],
			provider,
		);

		const [tokenDecimals, tokenSymbol, baseTokenDecimals, baseTokenSymbol] =
			await Promise.all([
				tokenContract.decimals(),
				tokenContract.symbol(),
				baseTokenContract.decimals(),
				baseTokenContract.symbol(),
			]);

		// Find a pool for this pair on Uniswap V3
		// This is a simplified approach - in production, you'd want to:
		// 1. Check multiple fee tiers (0.05%, 0.3%, 1%)
		// 2. Possibly use the Quoter contract for more accurate pricing

		// For this example, we'll just use the 0.3% fee tier
		const feeTier = 3000;

		// Get pool address
		const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"; // Uniswap V3 Factory
		const factory = new ethers.Contract(
			factoryAddress,
			[
				"function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
			],
			provider,
		);

		const poolAddress = await factory.getPool(
			tokenAddress,
			baseTokenAddress,
			feeTier,
		);

		// Check if pool exists
		if (poolAddress === "0x0000000000000000000000000000000000000000") {
			throw new Error(`No pool found for ${tokenSymbol}/${baseTokenSymbol}`);
		}

		// Get pool info
		const pool = new ethers.Contract(
			poolAddress,
			UNISWAP_V3_POOL_ABI,
			provider,
		);

		const [slot0, token0] = await Promise.all([pool.slot0(), pool.token0()]);

		const sqrtPriceX96 = slot0.sqrtPriceX96;

		// Calculate price from sqrtPriceX96
		const token0IsBaseToken =
			token0.toLowerCase() === baseTokenAddress.toLowerCase();

		// Calculate price from sqrtPriceX96
		// Price = (sqrtPriceX96 / 2^96)^2
		// Convert to BigInt to handle multiplication safely
		const sqrtPriceX96BigInt = BigInt(sqrtPriceX96.toString());
		const priceX96Squared = sqrtPriceX96BigInt * sqrtPriceX96BigInt;
		const denominator = BigInt(2) ** BigInt(192); // 2^(96*2)
		let rawPrice =
			(priceX96Squared *
				BigInt(10) **
					BigInt(token0IsBaseToken ? tokenDecimals : baseTokenDecimals)) /
			denominator /
			BigInt(10) **
				BigInt(token0IsBaseToken ? baseTokenDecimals : tokenDecimals);

		// If token0 is not the base token, we need to invert the price
		if (!token0IsBaseToken) {
			// Instead of division which can lead to precision issues, we use fixed point math
			const PRECISION = BigInt(10) ** BigInt(18);
			rawPrice = (PRECISION * PRECISION) / rawPrice;
		}

		// Convert to decimal string for consistent representation
		const priceString = rawPrice.toString();

		return {
			tokenA: tokenAddress,
			tokenB: baseTokenAddress,
			poolFee: feeTier,
			price: priceString,
			updatedAt: Date.now(),
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error("Error getting token price", {
			error: errorMessage,
			tokenAddress,
		});
		throw new Error(`Failed to get price for ${tokenAddress}: ${errorMessage}`);
	}
}

/**
 * Finds potential arbitrage opportunities across DEXes
 */
export async function findArbitrageOpportunities(
	config: PluginConfig,
	logger: typeof elizaLogger,
	tokenAddresses?: string[],
	minProfitPercentage = 0.5, // 0.5% minimum profit
	maxHops = 3,
): Promise<ArbitrageOpportunity[]> {
	logger.debug("Finding arbitrage opportunities", {
		tokenCount: tokenAddresses?.length,
		minProfitPercentage,
		maxHops,
	});

	// Use popular tokens if none specified
	const tokens = tokenAddresses || [
		USDC_ADDRESS, // USDC
		"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
		"0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
		"0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
		"0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
	];

	// In a real implementation, we would:
	// 1. Check prices across multiple DEXes (Uniswap, Sushiswap, etc.)
	// 2. Find paths where buying on one DEX and selling on another yields profit
	// 3. Calculate gas costs and verify the arbitrage is profitable

	// For this example, we'll simulate finding a few opportunities
	const opportunities: ArbitrageOpportunity[] = [];

	try {
		// Just as an example, we'll create a simulated opportunity
		// In a real implementation, this would come from price differences between DEXes

		// Get the provider
		const provider = getProvider(config);

		// Check just a couple of token pairs as an example
		for (let i = 0; i < tokens.length; i++) {
			for (let j = i + 1; j < tokens.length; j++) {
				// Skip if we've already found a few opportunities (for example purposes)
				if (opportunities.length >= 3) continue;

				const tokenA = tokens[i];
				const tokenB = tokens[j];

				try {
					// Get token info
					const tokenAContract = new ethers.Contract(
						tokenA,
						["function symbol() view returns (string)"],
						provider,
					);

					const tokenBContract = new ethers.Contract(
						tokenB,
						["function symbol() view returns (string)"],
						provider,
					);

					const [symbolA, symbolB] = await Promise.all([
						tokenAContract.symbol(),
						tokenBContract.symbol(),
					]);

					// Simulate finding an opportunity with a random profit between 0.5% and 2%
					const profitPercentage = Math.random() * 1.5 + minProfitPercentage;

					// Only include if it meets the minimum profit requirement
					if (profitPercentage >= minProfitPercentage) {
						opportunities.push({
							routeDescription: `${symbolA} → ${symbolB} arbitrage opportunity`,
							profitToken: "USDC",
							estimatedProfit: ((1000 * profitPercentage) / 100).toFixed(2),
							confidence: "medium",
						});
					}
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					logger.warn(`Error checking pair ${tokenA}/${tokenB}`, {
						error: errorMessage,
					});
					// Continue with other pairs
				}
			}
		}

		return opportunities;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error("Error finding arbitrage opportunities", {
			error: errorMessage,
		});
		throw new Error(`Failed to find arbitrage opportunities: ${errorMessage}`);
	}
}
