import {
	type Action,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	type State,
	elizaLogger,
} from "@elizaos/core";
import { ContractHelper } from "@realityspiral/plugin-coinbase";
import { ethers } from "ethers";
import {
	ABIS,
	POOL_FEES,
	SAPPHIRE_MAINNET,
	SAPPHIRE_TESTNET,
} from "../constants";
import { LiquidityService } from "../services/liquidityService";
import { PriceService } from "../services/priceService";
import { SwapService } from "../services/swapService";
import {
	type ArbitrageOpportunity,
	type LiquidityResult,
	type NebyPluginType,
	type PluginConfig,
	PluginConfigSchema,
	type PriceInfo,
	type SwapResult,
	type TransactionReceipt,
} from "../types";

// Helper function to get user address via ContractHelper
const getUserAddressString = async (
	runtime: IAgentRuntime,
	networkId: string,
): Promise<string> => {
	elizaLogger.info("Creating ContractHelper for getUserAddressString", {
		networkId,
	});
	const contractHelper = new ContractHelper(runtime);
	try {
		elizaLogger.info("Calling getUserAddress on ContractHelper", { networkId });
		const walletAddress = await contractHelper.getUserAddress(networkId);
		elizaLogger.info("Received wallet address", { walletAddress });

		const addressString = walletAddress as unknown as `0x${string}`;
		if (!addressString) {
			throw new Error(
				"User address string not found. Ensure wallet is connected and configured.",
			);
		}
		return addressString;
	} catch (error: unknown) {
		elizaLogger.error(
			"Failed to get user address string from ContractHelper",
			error instanceof Error
				? {
						message: error.message,
						stack: error.stack,
						name: error.name,
					}
				: error,
		);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Could not retrieve user address string: ${errorMessage}`);
	}
};

// Helper function to get configuration and network details
const _getConfigAndNetwork = (runtime: IAgentRuntime) => {
	const config: Partial<PluginConfig> = {
		network:
			(runtime.getSetting("NEBY_NETWORK") as PluginConfig["network"]) ||
			"mainnet",
		maxSlippage: Number.parseFloat(
			runtime.getSetting("NEBY_MAX_SLIPPAGE") || "0.5",
		),
		minLiquidity: Number.parseInt(
			runtime.getSetting("NEBY_MIN_LIQUIDITY") || "1000",
		),
		privacyLevel:
			(runtime.getSetting(
				"NEBY_PRIVACY_LEVEL",
			) as PluginConfig["privacyLevel"]) || "high",
		gasOptimization:
			(runtime.getSetting(
				"NEBY_GAS_OPTIMIZATION",
			) as PluginConfig["gasOptimization"]) || "medium",
		useConfidentialComputing:
			runtime.getSetting("NEBY_USE_CONFIDENTIAL_COMPUTING") !== "false",
	};

	const fullConfig = PluginConfigSchema.parse(config);
	const networkConfig =
		fullConfig.network === "mainnet" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;
	const networkId = fullConfig.network === "mainnet" ? "23294" : "23295";

	return { fullConfig, networkConfig, networkId };
};

/**
 * Implementation of the Neby DEX plugin for Oasis Sapphire
 */
export const nebyPlugin = (
	runtime: IAgentRuntime,
	config: Partial<PluginConfig> = {},
): NebyPluginType => {
	// Parse and validate configuration
	const fullConfig = PluginConfigSchema.parse({
		...config,
		network: config.network || "mainnet",
	});

	elizaLogger.info("Creating ContractHelper in nebyPlugin");
	const contractHelper = new ContractHelper(runtime);
	elizaLogger.info("ContractHelper created successfully");

	// Get network configuration
	const networkConfig =
		fullConfig.network === "mainnet" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;
	const networkId = fullConfig.network === "mainnet" ? "23294" : "23295";

	// Initialize services
	const swapService = new SwapService(
		contractHelper,
		networkId,
		networkConfig.CONTRACTS.SWAP_ROUTER_02,
		networkConfig.CONTRACTS.QUOTER,
	);

	const liquidityService = new LiquidityService(
		contractHelper,
		networkId,
		networkConfig.CONTRACTS.NFT_POSITION_MANAGER,
		networkConfig.CONTRACTS.V3_CORE_FACTORY,
	);

	const priceService = new PriceService(
		contractHelper,
		networkId,
		networkConfig.CONTRACTS.QUOTER,
		networkConfig.CONTRACTS.V3_CORE_FACTORY,
	);

	// Initialize
	elizaLogger.info("Neby DEX plugin initialized", {
		network: fullConfig.network,
		privacyLevel: fullConfig.privacyLevel,
		maxSlippage: fullConfig.maxSlippage,
		contractAddresses: {
			swapRouter: networkConfig.CONTRACTS.SWAP_ROUTER_02,
			quoter: networkConfig.CONTRACTS.QUOTER,
		},
	});

	// Add warning for missing testnet addresses
	if (fullConfig.network === "testnet") {
		const missingAddresses = Object.entries(networkConfig.CONTRACTS)
			.filter(([_, value]) => !value)
			.map(([key]) => key);

		if (missingAddresses.length > 0) {
			elizaLogger.warn(
				`Neby DEX Testnet configuration is missing contract addresses for: ${missingAddresses.join(", ")}. Plugin may not function correctly.`,
			);
		}
	}

	/**
	 * Swap tokens on Neby DEX
	 */
	const swap = async (
		fromToken: string,
		toToken: string,
		amount: string,
		slippage?: number,
	): Promise<SwapResult> => {
		try {
			const effectiveSlippage = slippage ?? fullConfig.maxSlippage;
			elizaLogger.info("Swapping tokens on Neby DEX", {
				fromToken,
				toToken,
				amount,
				slippage: effectiveSlippage,
			});

			const userAddress = await getUserAddressString(runtime, networkId);

			// 1. First, approve the router to spend our tokens if needed
			if (fromToken !== networkConfig.TOKENS.ROSE) {
				// If not native ROSE
				await swapService.approveTokenSpending(
					fromToken,
					networkConfig.CONTRACTS.SWAP_ROUTER_02,
					amount,
				);
			}

			// 2. Get quote for expected output
			const expectedOutput = await swapService.getSwapQuote(
				fromToken,
				toToken,
				amount,
			);

			// 3. Calculate minimum acceptable output based on slippage
			const minOutputAmount = ethers.formatUnits(
				(BigInt(expectedOutput) *
					BigInt(10000 - Math.floor(effectiveSlippage * 100))) /
					BigInt(10000),
				0,
			);

			// 4. Execute the swap
			return await swapService.executeSwap(
				fromToken,
				toToken,
				amount,
				minOutputAmount,
				userAddress,
			);
		} catch (error) {
			elizaLogger.error("Error in swap function", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	};

	/**
	 * Add liquidity to a pool
	 */
	const addLiquidity = async (
		tokenA: string,
		tokenB: string,
		amountA: string,
		amountB: string,
	): Promise<LiquidityResult> => {
		try {
			elizaLogger.info("Adding liquidity to Neby DEX pool", {
				tokenA,
				tokenB,
				amountA,
				amountB,
			});

			const userAddress = await getUserAddressString(runtime, networkId);

			// 1. Approve token spending if needed
			await Promise.all([
				liquidityService.approveTokenSpending(tokenA, amountA),
				liquidityService.approveTokenSpending(tokenB, amountB),
			]);

			// 2. Add liquidity
			return await liquidityService.addLiquidity(
				tokenA,
				tokenB,
				amountA,
				amountB,
				fullConfig.maxSlippage,
				userAddress,
			);
		} catch (error) {
			elizaLogger.error("Error in addLiquidity function", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	};

	/**
	 * Remove liquidity from a pool
	 */
	const removeLiquidity = async (
		tokenA: string,
		tokenB: string,
		liquidity: string,
	): Promise<LiquidityResult> => {
		try {
			elizaLogger.info("Removing liquidity from Neby DEX pool", {
				tokenA,
				tokenB,
				liquidity,
			});

			// Execute the remove liquidity operation
			return await liquidityService.removeLiquidity(tokenA, tokenB, liquidity);
		} catch (error) {
			elizaLogger.error("Error in removeLiquidity function", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	};

	/**
	 * Monitor token pair prices
	 */
	const monitorPrices = async (): Promise<PriceInfo[]> => {
		try {
			elizaLogger.info("Monitoring token prices on Neby DEX");

			// Get common token pairs to monitor
			// This could be configurable or based on user's portfolio
			const tokenPairs: Array<[string, string]> = [
				// Example token pairs - would be configured based on available tokens
				[networkConfig.TOKENS.ROSE, "0x..."], // ROSE/USDC (placeholder)
				["0x...", "0x..."], // Other pairs (placeholders)
			];

			// Monitor prices for these pairs
			return await priceService.monitorPrices(tokenPairs);
		} catch (error) {
			elizaLogger.error("Error in monitorPrices function", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return [];
		}
	};

	/**
	 * Find arbitrage opportunities
	 */
	const findArbitrageOpportunities = async (): Promise<
		ArbitrageOpportunity[]
	> => {
		try {
			elizaLogger.info("Finding arbitrage opportunities on Neby DEX");

			// Delegate to price service
			return await priceService.findArbitrageOpportunities();
		} catch (error) {
			elizaLogger.error("Error in findArbitrageOpportunities function", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return [];
		}
	};

	/**
	 * Get pool liquidity
	 */
	const getPoolLiquidity = async (
		tokenA: string,
		tokenB: string,
		fee: number = POOL_FEES.MEDIUM,
	): Promise<string> => {
		try {
			elizaLogger.info("Getting pool liquidity for token pair", {
				tokenA,
				tokenB,
				fee,
			});

			// Delegate to liquidity service
			return await liquidityService.getPoolLiquidity(tokenA, tokenB, fee);
		} catch (error) {
			elizaLogger.error("Error in getPoolLiquidity function", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return "0"; // Return 0 if there's an error
		}
	};

	/**
	 * Get detailed pool information
	 */
	const getPoolInfo = async (
		tokenA: string,
		tokenB: string,
		fee: number = POOL_FEES.MEDIUM,
	): Promise<Record<string, unknown>> => {
		try {
			elizaLogger.info("Getting pool info for token pair", {
				tokenA,
				tokenB,
				fee,
			});

			// Delegate to price service
			return await priceService.getPoolInfo(tokenA, tokenB, fee);
		} catch (error) {
			elizaLogger.error("Error in getPoolInfo function", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	};

	return {
		swap,
		addLiquidity,
		removeLiquidity,
		monitorPrices,
		findArbitrageOpportunities,
		getPoolLiquidity,
		getPoolInfo,
	};
};

// Actions definitions for the plugin
export const swapAction: Action = {
	name: "swap",
	description: "Swap tokens on Neby DEX.",
	validate: async () => true,
	similes: [],
	examples: [],
	severity: 0,
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<SwapResult> => {
		try {
			const fromToken = options?.fromToken;
			const toToken = options?.toToken;
			const amount = options?.amount;
			const slippage = options?.slippage;

			const plugin = nebyPlugin(runtime);
			return await plugin.swap(
				fromToken as string,
				toToken as string,
				amount as string,
				slippage as number | undefined,
			);
		} catch (error) {
			elizaLogger.error("Error in swap action handler", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	},
};

export const addLiquidityAction: Action = {
	name: "addLiquidity",
	description: "Add liquidity to a Neby DEX pool.",
	validate: async () => true,
	similes: [],
	examples: [],
	severity: 0,
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<LiquidityResult> => {
		try {
			const tokenA = options?.tokenA;
			const tokenB = options?.tokenB;
			const amountA = options?.amountA;
			const amountB = options?.amountB;

			const plugin = nebyPlugin(runtime);
			return await plugin.addLiquidity(
				tokenA as string,
				tokenB as string,
				amountA as string,
				amountB as string,
			);
		} catch (error) {
			elizaLogger.error("Error in addLiquidity action handler", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	},
};

export const removeLiquidityAction: Action = {
	name: "removeLiquidity",
	description: "Remove liquidity from a Neby DEX pool.",
	validate: async () => true,
	similes: [],
	examples: [],
	severity: 0,
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<LiquidityResult> => {
		try {
			const tokenA = options?.tokenA;
			const tokenB = options?.tokenB;
			const liquidity = options?.liquidity;

			const plugin = nebyPlugin(runtime);
			return await plugin.removeLiquidity(
				tokenA as string,
				tokenB as string,
				liquidity as string,
			);
		} catch (error) {
			elizaLogger.error("Error in removeLiquidity action handler", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	},
};

export const monitorPricesAction: Action = {
	name: "monitorPrices",
	description: "Monitor token prices on Neby DEX.",
	validate: async () => true,
	similes: [],
	examples: [],
	severity: 0,
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
	): Promise<PriceInfo[]> => {
		try {
			const plugin = nebyPlugin(runtime);
			return await plugin.monitorPrices();
		} catch (error) {
			elizaLogger.error("Error in monitorPrices action handler", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	},
};

export const findArbitrageOpportunitiesAction: Action = {
	name: "findArbitrageOpportunities",
	description: "Find arbitrage opportunities on Neby DEX.",
	validate: async () => true,
	similes: [],
	examples: [],
	severity: 0,
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
	): Promise<ArbitrageOpportunity[]> => {
		try {
			const plugin = nebyPlugin(runtime);
			return await plugin.findArbitrageOpportunities();
		} catch (error) {
			elizaLogger.error("Error in findArbitrageOpportunities action handler", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	},
};

export const getPoolLiquidityAction: Action = {
	name: "getPoolLiquidity",
	description: "Get liquidity of a Neby DEX pool.",
	validate: async () => true,
	similes: [],
	examples: [],
	severity: 0,
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<string> => {
		try {
			const tokenA = options?.tokenA;
			const tokenB = options?.tokenB;
			const fee = options?.fee;

			const plugin = nebyPlugin(runtime);
			return await plugin.getPoolLiquidity(
				tokenA as string,
				tokenB as string,
				fee as number | undefined,
			);
		} catch (error) {
			elizaLogger.error("Error in getPoolLiquidity action handler", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return "0"; // Return 0 if there's an error
		}
	},
};

export const getPoolInfoAction: Action = {
	name: "getPoolInfo",
	description: "Get detailed information about a Neby DEX pool.",
	validate: async () => true,
	similes: [],
	examples: [],
	severity: 0,
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<Record<string, unknown>> => {
		try {
			const tokenA = options?.tokenA;
			const tokenB = options?.tokenB;
			const fee = options?.fee;

			const plugin = nebyPlugin(runtime);
			return await plugin.getPoolInfo(
				tokenA as string,
				tokenB as string,
				fee as number | undefined,
			);
		} catch (error) {
			elizaLogger.error("Error in getPoolInfo action handler", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw error;
		}
	},
};

/**
 * Factory function to create a Neby DEX plugin instance
 */
export const nebyPluginFactory = (
	runtime: IAgentRuntime,
	config?: Partial<PluginConfig>,
): NebyPluginType => {
	return nebyPlugin(runtime, config);
};
