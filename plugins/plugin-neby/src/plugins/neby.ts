import {
	type Action,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	type State,
	elizaLogger,
} from "@elizaos/core";
import { ethers } from "ethers";
import {
	ABIS,
	POOL_FEES,
	SAPPHIRE_MAINNET,
	SAPPHIRE_TESTNET,
} from "../constants";
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
import { getUserAddress } from "../utils/ethersHelper";
import { LiquidityService } from "../utils/liquidityService";
import { PriceService } from "../utils/priceService";
import { SwapService } from "../utils/swapService";

// Helper function to get user address via ethersHelper
const getUserAddressString = async (
	runtime: IAgentRuntime,
	networkId: string,
): Promise<string> => {
	try {
		elizaLogger.info("Getting user address string via ethersHelper", {
			networkId,
		});
		const addressString = await getUserAddress(runtime, networkId);
		elizaLogger.info("Received wallet address", { addressString });

		if (!addressString) {
			throw new Error(
				"User address string not found. Ensure wallet is connected and configured.",
			);
		}
		return addressString as `0x${string}`;
	} catch (error: unknown) {
		elizaLogger.error(
			"Failed to get user address string from ethersHelper",
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

	// Get network configuration
	const networkConfig =
		fullConfig.network === "mainnet" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;
	const networkId = fullConfig.network === "mainnet" ? "23294" : "23295";

	// Initialize services, passing runtime
	const swapService = new SwapService(
		runtime,
		networkId,
		networkConfig.CONTRACTS.SWAP_ROUTER_02,
		networkConfig.CONTRACTS.QUOTER,
	);

	const liquidityService = new LiquidityService(
		runtime,
		networkId,
		networkConfig.CONTRACTS.NFT_POSITION_MANAGER,
		networkConfig.CONTRACTS.V3_CORE_FACTORY,
	);

	const priceService = new PriceService(
		runtime,
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
	name: "nebySwap",
	description: "Swap tokens on Neby DEX.",
	validate: async () => true,
	similes: [],
	examples: [],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<SwapResult> => {
		try {
			const { fullConfig, networkConfig, networkId } =
				_getConfigAndNetwork(runtime);
			const swapService = new SwapService(
				runtime,
				networkId,
				networkConfig.CONTRACTS.SWAP_ROUTER_02,
				networkConfig.CONTRACTS.QUOTER,
			);

			const fromToken = options?.fromToken as string;
			const toToken = options?.toToken as string;
			const amount = options?.amount as string;
			const slippage = options?.slippage as number | undefined;

			const effectiveSlippage = slippage ?? fullConfig.maxSlippage;
			const userAddress = await getUserAddressString(runtime, networkId);

			if (fromToken !== networkConfig.TOKENS.ROSE) {
				await swapService.approveTokenSpending(
					fromToken,
					networkConfig.CONTRACTS.SWAP_ROUTER_02,
					amount,
				);
			}
			const expectedOutput = await swapService.getSwapQuote(
				fromToken,
				toToken,
				amount,
			);
			const minOutputAmount = ethers.formatUnits(
				(BigInt(expectedOutput) *
					BigInt(10000 - Math.floor(effectiveSlippage * 100))) /
					BigInt(10000),
				0,
			);
			return await swapService.executeSwap(
				fromToken,
				toToken,
				amount,
				minOutputAmount,
				userAddress,
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
	name: "nebyAddLiquidity",
	description: "Add liquidity to a Neby DEX pool.",
	validate: async () => true,
	similes: [],
	examples: [],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<LiquidityResult> => {
		try {
			const { fullConfig, networkConfig, networkId } =
				_getConfigAndNetwork(runtime);
			const liquidityService = new LiquidityService(
				runtime,
				networkId,
				networkConfig.CONTRACTS.NFT_POSITION_MANAGER,
				networkConfig.CONTRACTS.V3_CORE_FACTORY,
			);

			const tokenA = options?.tokenA as string;
			const tokenB = options?.tokenB as string;
			const amountA = options?.amountA as string;
			const amountB = options?.amountB as string;

			const userAddress = await getUserAddressString(runtime, networkId);
			await Promise.all([
				liquidityService.approveTokenSpending(tokenA, amountA),
				liquidityService.approveTokenSpending(tokenB, amountB),
			]);
			return await liquidityService.addLiquidity(
				tokenA,
				tokenB,
				amountA,
				amountB,
				fullConfig.maxSlippage,
				userAddress,
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
	name: "nebyRemoveLiquidity",
	description: "Remove liquidity from a Neby DEX pool.",
	validate: async () => true,
	similes: [],
	examples: [],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<LiquidityResult> => {
		try {
			const { networkConfig, networkId } = _getConfigAndNetwork(runtime);
			const liquidityService = new LiquidityService(
				runtime,
				networkId,
				networkConfig.CONTRACTS.NFT_POSITION_MANAGER,
				networkConfig.CONTRACTS.V3_CORE_FACTORY,
			);

			const tokenA = options?.tokenA as string;
			const tokenB = options?.tokenB as string;
			const liquidity = options?.liquidity as string;

			return await liquidityService.removeLiquidity(tokenA, tokenB, liquidity);
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
	name: "nebyMonitorPrices",
	description: "Monitor token prices on Neby DEX.",
	validate: async () => true,
	similes: [],
	examples: [],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
	): Promise<PriceInfo[]> => {
		try {
			const { networkConfig, networkId } = _getConfigAndNetwork(runtime);
			const priceService = new PriceService(
				runtime,
				networkId,
				networkConfig.CONTRACTS.QUOTER,
				networkConfig.CONTRACTS.V3_CORE_FACTORY,
			);
			const tokenPairs: Array<[string, string]> = [];
			return await priceService.monitorPrices(tokenPairs);
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
	name: "nebyFindArbitrageOpportunities",
	description: "Find arbitrage opportunities on Neby DEX.",
	validate: async () => true,
	similes: [],
	examples: [],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
	): Promise<ArbitrageOpportunity[]> => {
		try {
			const { networkConfig, networkId } = _getConfigAndNetwork(runtime);
			const priceService = new PriceService(
				runtime,
				networkId,
				networkConfig.CONTRACTS.QUOTER,
				networkConfig.CONTRACTS.V3_CORE_FACTORY,
			);
			return await priceService.findArbitrageOpportunities();
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
	name: "nebyGetPoolLiquidity",
	description: "Get liquidity of a Neby DEX pool.",
	validate: async () => true,
	similes: [],
	examples: [],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<string> => {
		try {
			const { networkConfig, networkId } = _getConfigAndNetwork(runtime);
			const liquidityService = new LiquidityService(
				runtime,
				networkId,
				networkConfig.CONTRACTS.NFT_POSITION_MANAGER,
				networkConfig.CONTRACTS.V3_CORE_FACTORY,
			);

			const tokenA = options?.tokenA as string;
			const tokenB = options?.tokenB as string;
			const fee = options?.fee as number | undefined;

			return await liquidityService.getPoolLiquidity(tokenA, tokenB, fee);
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
	name: "nebyGetPoolInfo",
	description: "Get detailed information about a Neby DEX pool.",
	validate: async () => true,
	similes: [],
	examples: [],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		_state?: State,
		options?: Record<string, unknown>,
	): Promise<Record<string, unknown>> => {
		try {
			const { networkConfig, networkId } = _getConfigAndNetwork(runtime);
			const priceService = new PriceService(
				runtime,
				networkId,
				networkConfig.CONTRACTS.QUOTER,
				networkConfig.CONTRACTS.V3_CORE_FACTORY,
			);

			const tokenA = options?.tokenA as string;
			const tokenB = options?.tokenB as string;
			const fee = options?.fee as number | undefined;

			return await priceService.getPoolInfo(tokenA, tokenB, fee);
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
