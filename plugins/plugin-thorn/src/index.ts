import { type IAgentRuntime, type Plugin, elizaLogger } from "@elizaos/core";
import { ContractHelper } from "@realityspiral/plugin-coinbase";
import { ethers } from "ethers";
import {
	ABIS,
	OASIS_NETWORKS,
	OASIS_NETWORK_IDS,
	THORN_CONTRACTS,
	TOKEN_ADDRESSES,
} from "./constants";
import {
	createContractHelper,
	getNetworkId,
	getUserAddressString,
} from "./helpers/contractUtils";
import {
	type LiquidityPool,
	type PluginConfig,
	PluginConfigSchema,
	type PriceStabilityInfo,
	STABLECOIN_TOKENS,
	type SwapPath,
	type SwapResult,
} from "./types";

// Import the action definitions
import "./plugins/actions"; // temporary import to satisfy TypeScript while we transition
import {
	createStrategyAction,
	executeSwapAction,
	getLiquidityPoolsAction,
	getOptimalPathAction,
	getSwapHistoryAction,
} from "./plugins/actions";

/**
 * Thorn Protocol plugin factory function
 * Creates a procedural API for interacting with Thorn Protocol
 */
export const thornProtocolPlugin = (
	runtime: IAgentRuntime,
	config: Partial<PluginConfig> = {},
) => {
	// Parse and validate configuration
	const fullConfig = PluginConfigSchema.parse({
		...config,
		network: config.network || "mainnet",
		privacyLevel: config.privacyLevel || "high",
	});

	// Create contract helper
	const contractHelper = createContractHelper(runtime);

	// Get network configuration
	const networkConfig =
		fullConfig.network === "mainnet"
			? {
					networkId: OASIS_NETWORK_IDS.MAINNET,
					contracts: THORN_CONTRACTS.MAINNET,
				}
			: {
					networkId: OASIS_NETWORK_IDS.TESTNET,
					contracts: THORN_CONTRACTS.TESTNET,
				};

	/**
	 * Execute a stablecoin swap
	 */
	const executeSwap = async (
		fromToken: (typeof STABLECOIN_TOKENS)[number],
		toToken: (typeof STABLECOIN_TOKENS)[number],
		amount: string,
		slippage = 0.5,
		privacyLevel: string = fullConfig.privacyLevel,
	) => {
		// Validate inputs
		if (!fromToken || !toToken || !amount) {
			throw new Error(
				"Missing required parameters: fromToken, toToken, and amount are required",
			);
		}

		if (
			!STABLECOIN_TOKENS.includes(fromToken) ||
			!STABLECOIN_TOKENS.includes(toToken)
		) {
			throw new Error(
				`Invalid token. Supported tokens: ${STABLECOIN_TOKENS.join(", ")}`,
			);
		}

		// Get network and contract information
		const { networkId, contracts } = networkConfig;

		// Get user address
		const userAddress = await getUserAddressString(runtime, networkId);

		// Log the operation
		elizaLogger.info("Executing swap", {
			fromToken,
			toToken,
			amount,
			slippage,
			privacyLevel,
			userAddress,
		});

		// Get token addresses (with type checking and fallback)
		const network = fullConfig.network === "mainnet" ? "MAINNET" : "TESTNET";

		// Find token addresses (with safer handling for potentially missing tokens)
		let fromTokenAddress = "";
		let toTokenAddress = "";

		if (
			fromToken === "USDC" ||
			fromToken === "USDT" ||
			fromToken === "DAI" ||
			fromToken === "BUSD" ||
			fromToken === "FRAX"
		) {
			fromTokenAddress = TOKEN_ADDRESSES[network][fromToken];
		} else {
			throw new Error(`Token address not found for ${fromToken}`);
		}

		if (
			toToken === "USDC" ||
			toToken === "USDT" ||
			toToken === "DAI" ||
			toToken === "BUSD" ||
			toToken === "FRAX"
		) {
			toTokenAddress = TOKEN_ADDRESSES[network][toToken];
		} else {
			throw new Error(`Token address not found for ${toToken}`);
		}

		// Use the basic ERC20 interface
		const erc20Interface = [
			"function allowance(address owner, address spender) view returns (uint256)",
			"function approve(address spender, uint256 amount) returns (bool)",
		];

		// Check allowance and approve if needed
		const allowance = await contractHelper.readContract({
			networkId,
			contractAddress: fromTokenAddress,
			method: "allowance",
			args: [userAddress, contracts.STABLE_SWAP_ROUTER],
			abi: erc20Interface,
		});

		// If allowance is too low, approve the router to spend tokens
		if (allowance < amount) {
			// Maximum possible uint256 value for approval
			const maxApproval =
				"115792089237316195423570985008687907853269984665640564039457584007913129639935";

			const approvalResult = await contractHelper.invokeContract({
				networkId,
				contractAddress: fromTokenAddress,
				method: "approve",
				args: [contracts.STABLE_SWAP_ROUTER, maxApproval],
				abi: erc20Interface,
			});

			elizaLogger.info("Approved token spending", approvalResult);
		}

		// Calculate minimum output amount based on slippage
		const minReceived = calculateMinimumOutput(amount, slippage);

		// Execute the swap
		const swapResult = await contractHelper.invokeContract({
			networkId,
			contractAddress: contracts.STABLE_SWAP_ROUTER,
			method: "swapExactTokensForTokens",
			args: [
				amount,
				minReceived,
				[fromTokenAddress, toTokenAddress],
				userAddress,
				Math.floor(Date.now() / 1000) + 3600, // 1 hour deadline
			],
			abi: ABIS.STABLE_SWAP_ROUTER,
		});

		elizaLogger.info("Swap executed", swapResult);

		// Return a structured result
		return {
			transactionHash: swapResult.transactionLink?.split("/").pop() || "",
			fromToken,
			toToken,
			sentAmount: amount,
			receivedAmount: "0", // We would calculate this from swap events
			exchangeRate: "0", // We would calculate this
			fee: "0", // We would extract this from the transaction
			timestamp: Date.now(),
			privacyLevel,
		};
	};

	/**
	 * Helper function to calculate minimum output based on slippage
	 */
	const calculateMinimumOutput = (
		amount: string,
		slippagePercent: number,
	): string => {
		// Parse amount to number (simplified approach)
		const amountValue = Number.parseFloat(amount);

		if (isNaN(amountValue)) {
			throw new Error("Invalid amount format");
		}

		// Calculate slippage amount (slippagePercent is a percentage, e.g. 0.5 for 0.5%)
		const slippageFactor = 100 - slippagePercent;
		const minAmount = Math.floor((amountValue * slippageFactor) / 100);

		return minAmount.toString();
	};

	/**
	 * Get optimal swap path
	 */
	const getOptimalPath = async (
		fromToken: string,
		toToken: string,
		amount: string,
	): Promise<SwapPath> => {
		// Get network and contract information
		const { networkId, contracts } = networkConfig;
		const userAddress = await getUserAddressString(runtime, networkId);

		// Log the operation
		elizaLogger.info("Finding optimal swap path", {
			fromToken,
			toToken,
			amount,
			userAddress,
		});

		// Get token addresses
		const network = fullConfig.network === "mainnet" ? "MAINNET" : "TESTNET";

		// Find token addresses for the from and to tokens
		let fromTokenAddress = "";
		let toTokenAddress = "";

		if (STABLECOIN_TOKENS.includes(fromToken as any)) {
			fromTokenAddress =
				TOKEN_ADDRESSES[network][
					fromToken as keyof (typeof TOKEN_ADDRESSES)[typeof network]
				];
		} else {
			throw new Error(`Token address not found for ${fromToken}`);
		}

		if (STABLECOIN_TOKENS.includes(toToken as any)) {
			toTokenAddress =
				TOKEN_ADDRESSES[network][
					toToken as keyof (typeof TOKEN_ADDRESSES)[typeof network]
				];
		} else {
			throw new Error(`Token address not found for ${toToken}`);
		}

		// Check if direct swap is available (most efficient)
		const poolInfo = await contractHelper.readContract({
			networkId,
			contractAddress: contracts.STABLE_SWAP_FACTORY,
			method: "getPool",
			args: [fromTokenAddress, toTokenAddress],
			abi: ABIS.STABLE_SWAP_FACTORY,
		});

		// If pool address is not zero address, direct swap is available
		if (poolInfo && poolInfo !== ethers.ZeroAddress) {
			// Get pool exchange rate
			const poolRates = await contractHelper.readContract({
				networkId,
				contractAddress: contracts.STABLE_SWAP_INFO,
				method: "getAmountOut",
				args: [amount, fromTokenAddress, toTokenAddress, poolInfo],
				abi: ABIS.STABLE_SWAP_INFO,
			});

			const estimatedRate = poolRates
				? (Number(poolRates) / Number(amount)).toString()
				: "1";

			return {
				steps: [
					{
						fromToken,
						toToken,
						poolAddress: poolInfo,
						estimatedRate,
					},
				],
				totalExchangeRate: estimatedRate,
				estimatedGas: "300000", // Estimated gas for direct swap
				privacyScore:
					fullConfig.privacyLevel === "high"
						? 90
						: fullConfig.privacyLevel === "medium"
							? 70
							: 50,
			};
		}

		// If direct path not available, find intermediate paths (e.g., through USDC)
		// Common intermediate token for stablecoin swaps
		const intermediateToken = "USDC";
		const intermediateTokenAddress =
			TOKEN_ADDRESSES[network][
				intermediateToken as keyof (typeof TOKEN_ADDRESSES)[typeof network]
			];

		// Skip if source or destination is already the intermediate token
		if (fromToken === intermediateToken || toToken === intermediateToken) {
			throw new Error(
				`No direct path found between ${fromToken} and ${toToken}`,
			);
		}

		// Check for path through intermediate token
		const pool1Info = await contractHelper.readContract({
			networkId,
			contractAddress: contracts.STABLE_SWAP_FACTORY,
			method: "getPool",
			args: [fromTokenAddress, intermediateTokenAddress],
			abi: ABIS.STABLE_SWAP_FACTORY,
		});

		const pool2Info = await contractHelper.readContract({
			networkId,
			contractAddress: contracts.STABLE_SWAP_FACTORY,
			method: "getPool",
			args: [intermediateTokenAddress, toTokenAddress],
			abi: ABIS.STABLE_SWAP_FACTORY,
		});

		if (
			pool1Info &&
			pool1Info !== ethers.ZeroAddress &&
			pool2Info &&
			pool2Info !== ethers.ZeroAddress
		) {
			// Get rates for first hop
			const firstHopRates = await contractHelper.readContract({
				networkId,
				contractAddress: contracts.STABLE_SWAP_INFO,
				method: "getAmountOut",
				args: [amount, fromTokenAddress, intermediateTokenAddress, pool1Info],
				abi: ABIS.STABLE_SWAP_INFO,
			});

			// If we get intermediate amount, calculate second hop
			if (firstHopRates) {
				const secondHopRates = await contractHelper.readContract({
					networkId,
					contractAddress: contracts.STABLE_SWAP_INFO,
					method: "getAmountOut",
					args: [
						firstHopRates,
						intermediateTokenAddress,
						toTokenAddress,
						pool2Info,
					],
					abi: ABIS.STABLE_SWAP_INFO,
				});

				if (secondHopRates) {
					const totalRate = (
						Number(secondHopRates) / Number(amount)
					).toString();
					const step1Rate = (Number(firstHopRates) / Number(amount)).toString();
					const step2Rate = (
						Number(secondHopRates) / Number(firstHopRates)
					).toString();

					return {
						steps: [
							{
								fromToken,
								toToken: intermediateToken,
								poolAddress: pool1Info,
								estimatedRate: step1Rate,
							},
							{
								fromToken: intermediateToken,
								toToken,
								poolAddress: pool2Info,
								estimatedRate: step2Rate,
							},
						],
						totalExchangeRate: totalRate,
						estimatedGas: "600000", // Estimated gas for 2-hop swap
						privacyScore:
							fullConfig.privacyLevel === "high"
								? 80
								: fullConfig.privacyLevel === "medium"
									? 60
									: 40,
					};
				}
			}
		}

		throw new Error(
			`No viable swap path found between ${fromToken} and ${toToken}`,
		);
	};

	/**
	 * Get liquidity pools
	 */
	const getLiquidityPools = async (): Promise<LiquidityPool[]> => {
		// Get network and contract information
		const { networkId, contracts } = networkConfig;

		// Log the operation
		elizaLogger.info("Fetching liquidity pools", {
			network: fullConfig.network,
		});

		try {
			// Get the total number of pools
			const poolCount = await contractHelper.readContract({
				networkId,
				contractAddress: contracts.STABLE_SWAP_FACTORY,
				method: "allPoolsLength",
				args: [],
				abi: ABIS.STABLE_SWAP_FACTORY,
			});

			if (!poolCount || Number(poolCount) === 0) {
				return [];
			}

			const pools: LiquidityPool[] = [];

			// Fetch details for each pool
			for (let i = 0; i < Math.min(Number(poolCount), 20); i++) {
				// Limit to 20 pools for performance
				try {
					// Get the pool address at index i
					const poolAddress = await contractHelper.readContract({
						networkId,
						contractAddress: contracts.STABLE_SWAP_FACTORY,
						method: "allPools",
						args: [i],
						abi: ABIS.STABLE_SWAP_FACTORY,
					});

					if (!poolAddress || poolAddress === ethers.ZeroAddress) {
						continue;
					}

					// Get pool tokens
					const token0 = await contractHelper.readContract({
						networkId,
						contractAddress: poolAddress,
						method: "token0",
						args: [],
						abi: ABIS.STABLE_SWAP_ROUTER,
					});

					const token1 = await contractHelper.readContract({
						networkId,
						contractAddress: poolAddress,
						method: "token1",
						args: [],
						abi: ABIS.STABLE_SWAP_ROUTER,
					});

					// Get reserves
					const reserves = await contractHelper.readContract({
						networkId,
						contractAddress: poolAddress,
						method: "getReserves",
						args: [],
						abi: ABIS.STABLE_SWAP_ROUTER,
					});

					// Get fee (in basis points)
					const fee = await contractHelper.readContract({
						networkId,
						contractAddress: poolAddress,
						method: "fee",
						args: [],
						abi: ABIS.STABLE_SWAP_ROUTER,
					});

					// Map token addresses to symbols
					const network =
						fullConfig.network === "mainnet" ? "MAINNET" : "TESTNET";
					const tokenEntries = Object.entries(TOKEN_ADDRESSES[network]);

					const token0Symbol =
						tokenEntries.find(
							([_, address]) => address.toLowerCase() === token0.toLowerCase(),
						)?.[0] || token0.substring(0, 8) + "...";

					const token1Symbol =
						tokenEntries.find(
							([_, address]) => address.toLowerCase() === token1.toLowerCase(),
						)?.[0] || token1.substring(0, 8) + "...";

					// Calculate privacy level based on pool characteristics
					let privacyLevel: "low" | "medium" | "high" = "medium";

					// Larger pools generally provide better privacy
					if (
						reserves &&
						Number(reserves[0]) > 1000000 &&
						Number(reserves[1]) > 1000000
					) {
						privacyLevel = "high";
					} else if (
						reserves &&
						(Number(reserves[0]) < 100000 || Number(reserves[1]) < 100000)
					) {
						privacyLevel = "low";
					}

					pools.push({
						id: poolAddress,
						token0: token0Symbol,
						token1: token1Symbol,
						reserve0: reserves ? reserves[0].toString() : "0",
						reserve1: reserves ? reserves[1].toString() : "0",
						fee: fee ? (Number(fee) / 100).toString() + "%" : "0.3%",
						privacyLevel,
					});
				} catch (error) {
					elizaLogger.error(`Error fetching pool ${i} details`, { error });
					// Continue to next pool
				}
			}

			return pools;
		} catch (error) {
			elizaLogger.error("Error fetching liquidity pools", { error });
			throw new Error(
				`Failed to fetch liquidity pools: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	};

	/**
	 * Get swap history
	 */
	const getSwapHistory = async (): Promise<SwapResult[]> => {
		// Get network and contract information
		const { networkId, contracts } = networkConfig;
		const userAddress = await getUserAddressString(runtime, networkId);

		// Log the operation
		elizaLogger.info("Fetching swap history", {
			network: fullConfig.network,
			userAddress,
		});

		try {
			// Create provider from contractHelper's internal methods
			const provider = new ethers.JsonRpcProvider(
				(await runtime.getSetting("OASIS_RPC_URL")) ||
					`https://${fullConfig.network === "mainnet" ? "mainnet" : "testnet"}.explorer.oasis.io/api`,
			);

			// Create a contract instance for the router
			const routerContract = new ethers.Contract(
				contracts.STABLE_SWAP_ROUTER,
				ABIS.STABLE_SWAP_ROUTER,
				provider,
			);

			// Define the event filter - looking for events where the user is the sender
			const swapFilter = routerContract.filters.StableExchange(userAddress);

			// Get logs from the last 10,000 blocks (adjust as needed)
			const blockNumber = await provider.getBlockNumber();
			const logs = await routerContract.queryFilter(
				swapFilter,
				blockNumber - 10000,
				blockNumber,
			);

			if (!logs || logs.length === 0) {
				return [];
			}

			const network = fullConfig.network === "mainnet" ? "MAINNET" : "TESTNET";

			// Map token addresses to symbols for easier reading
			const addressToSymbol = new Map<string, string>();
			Object.entries(TOKEN_ADDRESSES[network]).forEach(([symbol, address]) => {
				addressToSymbol.set(address.toLowerCase(), symbol);
			});

			// Process the logs to create swap history entries
			const swapResults: SwapResult[] = [];

			for (const log of logs) {
				try {
					// Use log parsing utilities from ethers
					const parsedLog = routerContract.interface.parseLog({
						topics: log.topics as string[],
						data: log.data,
					});

					if (!parsedLog || !parsedLog.args) {
						continue;
					}

					// Get transaction receipt for additional info
					const receipt = await provider.getTransactionReceipt(
						log.transactionHash,
					);

					// Extract relevant info from the parsed event
					const fromToken =
						addressToSymbol.get(parsedLog.args.token1.toLowerCase()) ||
						parsedLog.args.token1.substring(0, 8) + "...";
					const toToken =
						addressToSymbol.get(parsedLog.args.token2.toLowerCase()) ||
						parsedLog.args.token2.substring(0, 8) + "...";

					// Calculate actual exchange rate
					const sentAmount = parsedLog.args.amountIn.toString();
					const receivedAmount = parsedLog.args.amountOut.toString();
					const exchangeRate = (
						Number(receivedAmount) / Number(sentAmount)
					).toString();

					// Calculate transaction fee
					const gasUsed = receipt?.gasUsed || ethers.getBigInt(0);
					const gasPrice = receipt?.gasPrice || ethers.getBigInt(0);
					const txFee = gasUsed * gasPrice;

					// Get timestamp from block
					const block = await provider.getBlock(log.blockNumber);
					const timestamp = block?.timestamp
						? Number(block.timestamp) * 1000
						: Date.now();

					swapResults.push({
						fromToken,
						toToken,
						sentAmount,
						receivedAmount,
						exchangeRate,
						fee: ethers.formatEther(txFee),
						txHash: log.transactionHash,
						timestamp,
						privacyLevel: fullConfig.privacyLevel as any,
					});
				} catch (error) {
					elizaLogger.error("Error processing swap log", {
						error,
						txHash: log.transactionHash,
					});
					// Skip this log if there's an error
				}
			}

			return swapResults;
		} catch (error) {
			elizaLogger.error("Error fetching swap history", { error });
			// Return empty array instead of throwing to maintain API consistency
			return [];
		}
	};

	/**
	 * Monitor price stability
	 */
	const monitorPrices = async (
		tokens: string[],
		threshold = 0.01,
	): Promise<PriceStabilityInfo[]> => {
		// Get network and contract information
		const { networkId, contracts } = networkConfig;

		// Log the operation
		elizaLogger.info("Monitoring stablecoin prices", {
			network: fullConfig.network,
			tokens,
			threshold,
		});

		// Filter and validate tokens
		const validTokens = tokens.filter((token) =>
			STABLECOIN_TOKENS.includes(token as any),
		);

		if (validTokens.length === 0) {
			throw new Error("No valid tokens provided for monitoring");
		}

		try {
			// Map token addresses
			const network = fullConfig.network === "mainnet" ? "MAINNET" : "TESTNET";
			const priceResults: PriceStabilityInfo[] = [];

			// Use a reference token (USDC) as the baseline
			const referenceToken = "USDC";
			const referenceTokenAddress =
				TOKEN_ADDRESSES[network][
					referenceToken as keyof (typeof TOKEN_ADDRESSES)[typeof network]
				];

			// Get prices for each token against the reference token
			for (const token of validTokens) {
				if (token === referenceToken) {
					// Reference token is always stable relative to itself
					priceResults.push({
						token,
						price: "1.00",
						deviation: 0,
						timestamp: Date.now(),
						isStable: true,
					});
					continue;
				}

				try {
					// Get token address
					const tokenAddress =
						TOKEN_ADDRESSES[network][
							token as keyof (typeof TOKEN_ADDRESSES)[typeof network]
						];

					if (!tokenAddress) {
						elizaLogger.warn(`Token address not found for ${token}`);
						continue;
					}

					// Find the pool for this token pair
					const poolAddress = await contractHelper.readContract({
						networkId,
						contractAddress: contracts.STABLE_SWAP_FACTORY,
						method: "getPool",
						args: [referenceTokenAddress, tokenAddress],
						abi: ABIS.STABLE_SWAP_FACTORY,
					});

					if (!poolAddress || poolAddress === ethers.ZeroAddress) {
						elizaLogger.warn(`No pool found for ${referenceToken}-${token}`);
						continue;
					}

					// Get reserves to calculate exchange rate
					const reserves = await contractHelper.readContract({
						networkId,
						contractAddress: poolAddress,
						method: "getReserves",
						args: [],
						abi: ABIS.STABLE_SWAP_ROUTER,
					});

					if (!reserves || !reserves[0] || !reserves[1]) {
						continue;
					}

					// Get token order in the pool
					const token0 = await contractHelper.readContract({
						networkId,
						contractAddress: poolAddress,
						method: "token0",
						args: [],
						abi: ABIS.STABLE_SWAP_ROUTER,
					});

					// Calculate the exchange rate based on token order
					let exchangeRate: number;

					if (token0.toLowerCase() === referenceTokenAddress.toLowerCase()) {
						// Reference token is token0
						exchangeRate = Number(reserves[1]) / Number(reserves[0]);
					} else {
						// Reference token is token1
						exchangeRate = Number(reserves[0]) / Number(reserves[1]);
					}

					// Calculate the deviation from the expected 1:1 ratio
					const deviation = Math.abs(1 - exchangeRate);
					const isStable = deviation <= threshold;

					priceResults.push({
						token,
						price: exchangeRate.toFixed(4),
						deviation,
						timestamp: Date.now(),
						isStable,
					});
				} catch (error) {
					elizaLogger.error(`Error monitoring price for ${token}`, { error });
					// Add a placeholder entry
					priceResults.push({
						token,
						price: "0.00",
						deviation: 0,
						timestamp: Date.now(),
						isStable: false,
					});
				}
			}

			return priceResults;
		} catch (error) {
			elizaLogger.error("Error monitoring prices", { error });
			throw new Error(
				`Failed to monitor prices: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	};

	/**
	 * Create trading strategy
	 */
	const createStrategy = async (
		name: string,
		targetToken: string,
		sourceTokens: string[],
		budget: string,
		options: any = {},
	) => {
		// Validate inputs
		if (!name || !targetToken || !sourceTokens || !budget) {
			throw new Error(
				"Missing required parameters: name, targetToken, sourceTokens, and budget are required",
			);
		}

		// Validate tokens
		if (!STABLECOIN_TOKENS.includes(targetToken as any)) {
			throw new Error(
				`Invalid target token. Supported tokens: ${STABLECOIN_TOKENS.join(", ")}`,
			);
		}

		for (const token of sourceTokens) {
			if (!STABLECOIN_TOKENS.includes(token as any)) {
				throw new Error(
					`Invalid source token: ${token}. Supported tokens: ${STABLECOIN_TOKENS.join(", ")}`,
				);
			}
		}

		// Get network and contract information
		const { networkId, contracts } = networkConfig;
		const userAddress = await getUserAddressString(runtime, networkId);

		// Parse options with defaults
		const {
			maxSlippage = 0.5,
			triggerThreshold = 0.005,
			isActive = true,
			timeBetweenTrades = 3600, // 1 hour in seconds
			gasLimit = "300000",
		} = options;

		// Log the operation
		elizaLogger.info("Creating trading strategy", {
			name,
			targetToken,
			sourceTokens,
			budget,
			userAddress,
			maxSlippage,
			triggerThreshold,
			isActive,
		});

		try {
			// Get token addresses
			const network = fullConfig.network === "mainnet" ? "MAINNET" : "TESTNET";
			const targetTokenAddress =
				TOKEN_ADDRESSES[network][
					targetToken as keyof (typeof TOKEN_ADDRESSES)[typeof network]
				];

			const sourceTokenAddresses = sourceTokens.map(
				(token) =>
					TOKEN_ADDRESSES[network][
						token as keyof (typeof TOKEN_ADDRESSES)[typeof network]
					],
			);

			// First, need to deploy a strategy contract
			// This would typically use a factory pattern
			const deployTx = await contractHelper.invokeContract({
				networkId,
				contractAddress: contracts.STRATEGY_FACTORY,
				method: "createStrategy",
				args: [
					name,
					targetTokenAddress,
					sourceTokenAddresses,
					budget,
					ethers.parseUnits(maxSlippage.toString(), 18),
					ethers.parseUnits(triggerThreshold.toString(), 18),
					isActive,
					timeBetweenTrades,
				],
				abi: ABIS.STRATEGY_FACTORY,
				gasLimit,
			});

			// Wait for transaction confirmation
			elizaLogger.info("Strategy creation submitted", deployTx);

			// Extract the strategy address from the transaction receipt or events
			// In a real implementation, we would parse the transaction receipt to get the new strategy address
			// For this example, we'll get it from the factory directly using the latest index

			// Get the count of strategies for the user
			const strategyCount = await contractHelper.readContract({
				networkId,
				contractAddress: contracts.STRATEGY_FACTORY,
				method: "getUserStrategyCount",
				args: [userAddress],
				abi: ABIS.STRATEGY_FACTORY,
			});

			// Get the address of the last created strategy
			const strategyAddress = await contractHelper.readContract({
				networkId,
				contractAddress: contracts.STRATEGY_FACTORY,
				method: "userStrategies",
				args: [userAddress, Number(strategyCount) - 1],
				abi: ABIS.STRATEGY_FACTORY,
			});

			// Get additional strategy details
			const strategyDetails = await contractHelper.readContract({
				networkId,
				contractAddress: strategyAddress,
				method: "getStrategyDetails",
				args: [],
				abi: ABIS.STRATEGY_CONTRACT,
			});

			// Format the result
			return {
				id: strategyAddress,
				name,
				targetToken,
				sourceTokens,
				budget,
				maxSlippage,
				triggerThreshold,
				active: isActive,
				createdAt: Date.now(),
				nextExecutionTime: strategyDetails
					? Number(strategyDetails.nextExecutionTime) * 1000
					: 0,
				executionCount: strategyDetails
					? Number(strategyDetails.executionCount)
					: 0,
				owner: userAddress,
			};
		} catch (error) {
			elizaLogger.error("Error creating strategy", { error });
			throw new Error(
				`Failed to create strategy: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	};

	// Return the plugin API
	return {
		executeSwap,
		getOptimalPath,
		getLiquidityPools,
		getSwapHistory,
		monitorPrices,
		createStrategy,
	};
};

// Define the plugin for agent integration (temporary definition while we transition)
export const thornPlugin: Plugin = {
	name: "thorn",
	description:
		"Plugin for privacy-preserving stablecoin operations with Thorn Protocol",
	actions: [
		executeSwapAction,
		getOptimalPathAction,
		getLiquidityPoolsAction,
		getSwapHistoryAction,
		createStrategyAction,
	],
	providers: [],
};

// Re-export types and constants for external use
export * from "./types";
export { ABIS, OASIS_NETWORKS, OASIS_NETWORK_IDS, THORN_CONTRACTS };

// Re-export helper utilities
export {
	ContractHelper,
	createContractHelper,
	getNetworkId,
	getUserAddressString,
};

export default thornPlugin;
