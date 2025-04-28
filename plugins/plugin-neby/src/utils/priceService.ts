import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ethers } from "ethers";
import {
	ABIS,
	POOL_FEES,
	SAPPHIRE_MAINNET,
	SAPPHIRE_TESTNET,
	UNISWAP_V3_POOL_ABI,
	UNISWAP_V3_QUOTER_ABI,
} from "../constants";
import type { ArbitrageOpportunity, PluginConfig, PriceInfo } from "../types";
import { readContract } from "./ethersHelper";
import { sortTokens } from "./utils";

/**
 * Service for monitoring prices and finding arbitrage opportunities
 */
export class PriceService {
	private runtime: IAgentRuntime;
	private networkId: string;
	private quoterAddress: string;
	private factoryAddress: string;

	constructor(
		runtime: IAgentRuntime,
		networkId: string,
		quoterAddress: string,
		factoryAddress: string,
	) {
		this.runtime = runtime;
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
			elizaLogger.info("Getting price for token pair using quoteExactInput", {
				tokenA,
				tokenB,
				fee,
			});

			// For price quotes, we use the smallest possible amount (1 wei) to minimize price impact
			const amountIn = "1";

			// Encode the path for quoteExactInput: tokenIn, fee, tokenOut
			const path = ethers.solidityPacked(
				["address", "uint24", "address"],
				[tokenA, fee, tokenB],
			);

			// Use readContract from ethersHelper
			const amountOut = await readContract<string>({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: this.quoterAddress,
				method: "quoteExactInput",
				args: [path, amountIn],
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
			const poolAddress = await readContract<string>({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: this.factoryAddress,
				method: "getPool",
				args: [token0, token1, fee],
				abi: ABIS.V3_CORE_FACTORY,
			});

			if (!poolAddress || poolAddress === ethers.ZeroAddress) {
				throw new Error("Pool not found");
			}

			// Get pool slots (contains liquidity, last observation, etc.)
			const slot0 = await readContract<any>({
				runtime: this.runtime,
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
			const liquidity = await readContract<string>({
				runtime: this.runtime,
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
				sqrtPriceX96: slot0.sqrtPriceX96,
				tick: slot0.tick,
				liquidity: liquidity,
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
