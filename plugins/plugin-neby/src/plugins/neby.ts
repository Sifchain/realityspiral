import {
	type Action,
	type Content,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type Plugin,
	type State,
	composeContext,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import { ethers } from "ethers";
import type { z } from "zod";
import {
	ABIS,
	POOL_FEES,
	SAPPHIRE_MAINNET,
	SAPPHIRE_TESTNET,
} from "../constants";
import {
	AddLiquidityActionSchema,
	GetPoolDetailsActionSchema,
	MonitorPricesActionSchema,
	RemoveLiquidityActionSchema,
	SwapActionSchema,
} from "../schemas";
import {
	addLiquidityTemplate,
	getPoolDetailsTemplate,
	monitorPricesTemplate,
	removeLiquidityTemplate,
	swapTemplate,
} from "../templates";
import {
	type ArbitrageOpportunity,
	type LiquidityResult,
	type NebyPluginType,
	type PluginConfig,
	PluginConfigSchema,
	type PriceInfo,
	type SwapResult,
} from "../types";
import { getUserAddress } from "../utils/ethersHelper";
import { LiquidityService } from "../utils/liquidityService";
import { PriceService } from "../utils/priceService";
import { SwapService } from "../utils/swapService";

// --- Validate Action --- //
const validate: Action["validate"] = async (runtime: IAgentRuntime) => {
	try {
		const pk =
			runtime.getSetting("WALLET_PRIVATE_KEY") ||
			process.env.WALLET_PRIVATE_KEY ||
			runtime.getSetting("ROFL_PLUGIN_ENABLED") ||
			process.env.ROFL_PLUGIN_ENABLED;
		return !!pk;
	} catch {
		return false;
	}
};

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
 * This function now returns a Plugin object containing actions.
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

	// Initialize services ONCE
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

	// Initialize Log
	elizaLogger.info("Neby DEX plugin initialized", {
		network: fullConfig.network,
		privacyLevel: fullConfig.privacyLevel,
		maxSlippage: fullConfig.maxSlippage,
		contractAddresses: {
			swapRouter: networkConfig.CONTRACTS.SWAP_ROUTER_02,
			quoter: networkConfig.CONTRACTS.QUOTER,
		},
	});

	// Warning for missing testnet addresses
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

	// --- Internal Logic Methods --- (using initialized services)

	const swap = async (
		fromToken: string,
		toToken: string,
		amount: string,
		slippage?: number,
	): Promise<SwapResult> => {
		try {
			const effectiveSlippage = slippage ?? fullConfig.maxSlippage;
			const userAddress = await getUserAddressString(runtime, networkId);

			const amountIn = ethers.parseUnits(amount, 18); // Token with 18 decimals

			if (fromToken !== networkConfig.TOKENS.ROSE) {
				await swapService.approveTokenSpending(
					fromToken,
					networkConfig.CONTRACTS.SWAP_ROUTER_02,
					amountIn.toString(),
				);
			}

			const expectedOutput = await swapService.getSwapQuote(
				fromToken,
				toToken,
				amountIn.toString(),
			);

			// get amountOut from quote
			const amountOut = expectedOutput["0"];

			const amountOutBigInt = BigInt(amountOut);
			const slippageBasisPoints = BigInt(Math.floor(effectiveSlippage * 100));
			const minOutputAmountBigInt =
				(amountOutBigInt * (BigInt(10000) - slippageBasisPoints)) /
				BigInt(10000);

			return await swapService.executeSwap(
				fromToken,
				toToken,
				amountIn.toString(),
				minOutputAmountBigInt.toString(),
				userAddress,
			);
		} catch (error) {
			elizaLogger.error("Error in internal swap method", { error });
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
			elizaLogger.error("Error in internal addLiquidity method", { error });
			throw error;
		}
	};

	const removeLiquidity = async (
		tokenA: string,
		tokenB: string,
		liquidity: string,
	): Promise<LiquidityResult> => {
		try {
			return await liquidityService.removeLiquidity(tokenA, tokenB, liquidity);
		} catch (error) {
			elizaLogger.error("Error in internal removeLiquidity method", { error });
			throw error;
		}
	};

	const monitorPrices = async (
		tokenPairs: Array<[string, string]>,
	): Promise<PriceInfo[]> => {
		try {
			return await priceService.monitorPrices(tokenPairs);
		} catch (error) {
			elizaLogger.error("Error in internal monitorPrices method", {
				tokenPairs,
				error,
			});
			throw error;
		}
	};

	const getPoolLiquidity = async (
		tokenA: string,
		tokenB: string,
		fee?: number,
	): Promise<string> => {
		try {
			const effectiveFee = fee ?? POOL_FEES.MEDIUM;
			return await liquidityService.getPoolLiquidity(
				tokenA,
				tokenB,
				effectiveFee,
			);
		} catch (error) {
			elizaLogger.error("Error in internal getPoolLiquidity method", {
				tokenA,
				tokenB,
				fee,
				error,
			});
			throw error;
		}
	};

	const getPoolInfo = async (
		tokenA: string,
		tokenB: string,
		fee?: number,
	): Promise<Record<string, unknown>> => {
		try {
			const effectiveFee = fee ?? POOL_FEES.MEDIUM;
			return await priceService.getPoolInfo(tokenA, tokenB, effectiveFee);
		} catch (error) {
			elizaLogger.error("Error in internal getPoolInfo method", {
				tokenA,
				tokenB,
				fee,
				error,
			});
			throw error;
		}
	};

	return {
		swap,
		addLiquidity,
		removeLiquidity,
		monitorPrices,
		getPoolLiquidity,
		getPoolInfo,
	};
};

// --- Action Definitions --- (defined within the plugin scope)

export const swapAction: Action = {
	name: "NEBY_SWAP",
	description: "Swap tokens on Neby DEX.",
	validate,
	similes: ["NEBY_SWAP_TOKENS", "NEBY_EXCHANGE_COINS", "NEBY_TRADE_CRYPTO"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Neby Swap 100 wROSE for USDC on Neby using my default slippage",
					actions: [
						{
							name: "NEBY_SWAP",
							options: {
								fromToken: "0x...wROSE_ADDRESS...",
								toToken: "0x...USDC_ADDRESS...",
								amount: "100",
							},
						},
					],
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Neby Swap executed successfully! Transaction hash: 0x...tx_hash... Swapped 100 wROSE for ~95 USDC.",
					result: {
						transactionHash: "0x...tx_hash...",
						fromToken: "0x...wROSE_ADDRESS...",
						toToken: "0x...USDC_ADDRESS...",
						amountIn: "100000000000000000000",
						amountOut: "95000000",
						timestamp: 1678886400,
					},
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Neby Swap 0.5 wROSE for USDC on Neby using my default slippage",
					actions: [
						{
							name: "NEBY_SWAP",
							options: {
								fromToken: "0x...wROSE_ADDRESS...",
								toToken: "0x...USDC_ADDRESS...",
								amount: "0.5",
							},
						},
					],
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Neby Swap executed successfully! Transaction hash: 0x...tx_hash... Swapped 0.5 wROSE for ~0.475 USDC.",
					result: {
						transactionHash: "0x...tx_hash...",
						fromToken: "0x...wROSE_ADDRESS...",
						toToken: "0x...USDC_ADDRESS...",
						amountIn: "500000000000000000",
						amountOut: "475000",
						timestamp: 1678886400,
					},
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Neby Swap 1000 wROSE for USDC on Neby using my default slippage",
					actions: [
						{
							name: "NEBY_SWAP",
							options: {
								fromToken: "0x...wROSE_ADDRESS...",
								toToken: "0x...USDC_ADDRESS...",
								amount: "1000",
							},
						},
					],
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Neby Swap executed successfully! Transaction hash: 0x...tx_hash... Swapped 1000 wROSE for ~950 USDC.",
					result: {
						transactionHash: "0x...tx_hash...",
						fromToken: "0x...wROSE_ADDRESS...",
						toToken: "0x...USDC_ADDRESS...",
						amountIn: "1000000000000000000000",
						amountOut: "950000000",
						timestamp: 1678886400,
					},
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Neby Swap 0.01 wROSE for USDC on Neby using my default slippage",
					actions: [
						{
							name: "NEBY_SWAP",
							options: {
								fromToken: "0x...wROSE_ADDRESS...",
								toToken: "0x...USDC_ADDRESS...",
								amount: "0.01",
							},
						},
					],
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Neby Swap executed successfully! Transaction hash: 0x...tx_hash... Swapped 0.01 wROSE for ~0.0095 USDC.",
					result: {
						transactionHash: "0x...tx_hash...",
						fromToken: "0x...wROSE_ADDRESS...",
						toToken: "0x...USDC_ADDRESS...",
						amountIn: "10000000000000000",
						amountOut: "9500",
						timestamp: 1678886400,
					},
				},
			},
		],
	],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State | undefined,
		_options: unknown,
		callback?: HandlerCallback,
	) => {
		elizaLogger.debug("Starting NEBY_SWAP action handler...");
		try {
			if (!state) {
				throw new Error("Action handler called without state.");
			}
			const context = composeContext({ state, template: swapTemplate });
			const generated = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: SwapActionSchema,
			});

			if (!generated.object) {
				throw new Error("Failed to extract swap parameters from message.");
			}

			const plugin = nebyPlugin(runtime);

			const { fromToken, toToken, amount, slippage } =
				generated.object as z.infer<typeof SwapActionSchema>;
			elizaLogger.info("Extracted swap parameters:", {
				fromToken,
				toToken,
				amount,
				slippage,
			});

			const result = await plugin.swap(fromToken, toToken, amount, slippage);

			const response: Content = {
				text: `Swap executed successfully! Tx: ${result.transactionHash}. Swapped ${amount} of ${fromToken} for ${result.amountOut} of ${toToken}.`,
				result,
			};
			if (callback) callback(response, []);
		} catch (error) {
			elizaLogger.error("Error in NEBY_SWAP handler:", error);
			if (callback)
				callback(
					{
						text: `Swap failed: ${error instanceof Error ? error.message : "Unknown error"}`,
					},
					[],
				);
		}
	},
};

export const addLiquidityAction: Action = {
	name: "NEBY_ADD_LIQUIDITY",
	description: "Add liquidity to a Neby DEX pool.",
	validate,
	similes: [
		"NEBY_PROVIDE_LIQUIDITY",
		"NEBY_STAKE_LP_TOKENS",
		"NEBY_ADD_TO_POOL",
	],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Neby Add 50 ROSE and 45 USDC liquidity to the ROSE/USDC pool on Neby",
					actions: [
						{
							name: "NEBY_ADD_LIQUIDITY",
							options: {
								tokenA: "0x...ROSE_ADDRESS...",
								tokenB: "0x...USDC_ADDRESS...",
								amountA: "50000000000000000000",
								amountB: "45000000",
							},
						},
					],
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Neby Liquidity added successfully! Transaction hash: 0x...tx_hash... Received LP NFT/position details.",
					result: {
						transactionHash: "0x...tx_hash...",
						tokenA: "0x...ROSE_ADDRESS...",
						tokenB: "0x...USDC_ADDRESS...",
						amountA: "50000000000000000000",
						amountB: "45000000",
						liquidity: "1234567890123456789",
						timestamp: 1678886400,
					},
				},
			},
		],
	],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State | undefined,
		_options: unknown,
		callback?: HandlerCallback,
	) => {
		elizaLogger.debug("Starting NEBY_ADD_LIQUIDITY action handler...");
		try {
			if (!state) {
				throw new Error("Action handler called without state.");
			}
			const context = composeContext({
				state,
				template: addLiquidityTemplate,
			});
			const generated = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: AddLiquidityActionSchema,
			});

			if (!generated.object) {
				throw new Error("Failed to extract add liquidity parameters.");
			}

			const { tokenA, tokenB, amountA, amountB } = generated.object as z.infer<
				typeof AddLiquidityActionSchema
			>;
			elizaLogger.info("Extracted add liquidity parameters:", {
				tokenA,
				tokenB,
				amountA,
				amountB,
			});

			const plugin = nebyPlugin(runtime);

			const result = await plugin.addLiquidity(
				tokenA,
				tokenB,
				amountA,
				amountB,
			);

			const response: Content = {
				text: `Added liquidity (${amountA} ${tokenA}, ${amountB} ${tokenB}). Tx: ${result.transactionHash}. Liquidity received: ${result.liquidity}`,
				result,
			};
			if (callback) callback(response, []);
		} catch (error) {
			elizaLogger.error("Error in NEBY_ADD_LIQUIDITY handler:", error);
			if (callback)
				callback(
					{
						text: `Add liquidity failed: ${error instanceof Error ? error.message : "Unknown error"}`,
					},
					[],
				);
		}
	},
};

export const removeLiquidityAction: Action = {
	name: "NEBY_REMOVE_LIQUIDITY",
	description: "Remove liquidity from a Neby DEX pool.",
	validate,
	similes: [
		"NEBY_WITHDRAW_LIQUIDITY",
		"NEBY_UNSTAKE_LP_TOKENS",
		"NEBY_REMOVE_FROM_POOL",
	],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Neby Remove my liquidity (ID/amount: 1234567890123456789) from the ROSE/USDC pool",
					actions: [
						{
							name: "NEBY_REMOVE_LIQUIDITY",
							options: {
								tokenA: "0x...ROSE_ADDRESS...",
								tokenB: "0x...USDC_ADDRESS...",
								liquidity: "1234567890123456789",
							},
						},
					],
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Neby Liquidity removed successfully! Transaction hash: 0x...tx_hash... Received ~48 ROSE and ~43 USDC.",
					result: {
						transactionHash: "0x...tx_hash...",
						tokenA: "0x...ROSE_ADDRESS...",
						tokenB: "0x...USDC_ADDRESS...",
						amountA: "48000000000000000000",
						amountB: "43000000",
						liquidity: "1234567890123456789",
						timestamp: 1678886500,
					},
				},
			},
		],
	],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State | undefined,
		_options: unknown,
		callback?: HandlerCallback,
	) => {
		elizaLogger.debug("Starting NEBY_REMOVE_LIQUIDITY action handler...");
		try {
			if (!state) {
				throw new Error("Action handler called without state.");
			}
			const context = composeContext({
				state,
				template: removeLiquidityTemplate,
			});
			const generated = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: RemoveLiquidityActionSchema,
			});

			if (!generated.object) {
				throw new Error("Failed to extract remove liquidity parameters.");
			}

			const plugin = nebyPlugin(runtime);

			const { tokenA, tokenB, liquidity } = generated.object as z.infer<
				typeof RemoveLiquidityActionSchema
			>;
			elizaLogger.info("Extracted remove liquidity parameters:", {
				tokenA,
				tokenB,
				liquidity,
			});

			const result = await plugin.removeLiquidity(tokenA, tokenB, liquidity);

			const response: Content = {
				text: `Removed liquidity ${liquidity} for ${tokenA}/${tokenB}. Tx: ${result.transactionHash}. Received ${result.amountA} ${tokenA} and ${result.amountB} ${tokenB}.`,
				result,
			};
			if (callback) callback(response, []);
		} catch (error) {
			elizaLogger.error("Error in NEBY_REMOVE_LIQUIDITY handler:", error);
			if (callback)
				callback(
					{
						text: `Remove liquidity failed: ${error instanceof Error ? error.message : "Unknown error"}`,
					},
					[],
				);
		}
	},
};

export const monitorPricesAction: Action = {
	name: "NEBY_MONITOR_PRICES",
	description: "Monitor token prices on Neby DEX.",
	validate,
	similes: ["NEBY_CHECK_PRICES", "NEBY_GET_TOKEN_RATES", "NEBY_WATCH_MARKET"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Neby What are the current prices for ROSE/USDC and wETH/ROSE on Neby?",
					actions: [
						{
							name: "NEBY_MONITOR_PRICES",
							options: {
								tokenPairs: [
									["0x...ROSE_ADDRESS...", "0x...USDC_ADDRESS..."],
									["0x...WETH_ADDRESS...", "0x...ROSE_ADDRESS..."],
								],
							},
						},
					],
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Neby Current prices:\n- ROSE/USDC (0.3% fee pool): 0.95 USDC per ROSE\n- wETH/ROSE (0.3% fee pool): 3500 ROSE per wETH",
					result: [
						{
							tokenA: "0x...ROSE_ADDRESS...",
							tokenB: "0x...USDC_ADDRESS...",
							poolFee: 3000,
							price: "950000",
							updatedAt: 1678886600,
						},
						{
							tokenA: "0x...WETH_ADDRESS...",
							tokenB: "0x...ROSE_ADDRESS...",
							poolFee: 3000,
							price: "3500000000000000000000",
							updatedAt: 1678886600,
						},
					],
				},
			},
		],
	],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State | undefined,
		_options: unknown,
		callback?: HandlerCallback,
	) => {
		elizaLogger.debug("Starting NEBY_MONITOR_PRICES action handler...");
		try {
			if (!state) {
				throw new Error("Action handler called without state.");
			}
			const context = composeContext({
				state,
				template: monitorPricesTemplate,
			});
			const generated = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: MonitorPricesActionSchema,
			});
			const typedObject = generated.object as
				| z.infer<typeof MonitorPricesActionSchema>
				| undefined;

			if (!typedObject?.tokenPairs || typedObject.tokenPairs.length === 0) {
				if (callback)
					callback(
						{
							text: "Which token pairs would you like me to monitor? Please provide their contract addresses.",
						},
						[],
					);
				return;
			}

			const { tokenPairs } = typedObject;
			elizaLogger.info("Extracted monitor prices parameters:", {
				tokenPairs,
			});

			const plugin = nebyPlugin(runtime);

			const results = await plugin.monitorPrices(
				tokenPairs as Array<[string, string]>,
			);

			let responseText = "Current prices:\n";
			if (results.length === 0) {
				responseText =
					"Could not retrieve prices for the specified pairs. They might not have active pools.";
			} else {
				responseText += results
					.map(
						(p) =>
							`- ${p.tokenA}/${p.tokenB} (${p.poolFee / 10000}% fee): ${p.price}`,
					)
					.join("\n");
			}

			const response: Content = {
				text: responseText,
				result: results,
			};
			if (callback) callback(response, []);
		} catch (error) {
			elizaLogger.error("Error in NEBY_MONITOR_PRICES handler:", error);
			if (callback)
				callback(
					{
						text: `Failed to monitor prices: ${error instanceof Error ? error.message : "Unknown error"}`,
					},
					[],
				);
		}
	},
};

export const getPoolLiquidityAction: Action = {
	name: "NEBY_GET_POOL_LIQUIDITY",
	description: "Get liquidity of a Neby DEX pool.",
	validate,
	similes: ["NEBY_CHECK_POOL_SIZE", "NEBY_GET_POOL_VALUE", "NEBY_POOL_TVL"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Neby How much liquidity is in the ROSE/USDC 0.3% pool?",
					actions: [
						{
							name: "NEBY_GET_POOL_LIQUIDITY",
							options: {
								tokenA: "0x...ROSE_ADDRESS...",
								tokenB: "0x...USDC_ADDRESS...",
								fee: 3000,
							},
						},
					],
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Neby The current liquidity in the ROSE/USDC 0.3% pool is approximately 1,500,000 (represented as a raw liquidity value).",
					result: "1500000000000000000000000",
				},
			},
		],
	],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State | undefined,
		_options: unknown,
		callback?: HandlerCallback,
	) => {
		elizaLogger.debug("Starting NEBY_GET_POOL_LIQUIDITY action handler...");
		try {
			if (!state) {
				throw new Error("Action handler called without state.");
			}
			const context = composeContext({
				state,
				template: getPoolDetailsTemplate,
			});
			const generated = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: GetPoolDetailsActionSchema,
			});

			if (!generated.object) {
				throw new Error("Failed to extract pool details parameters.");
			}

			const { tokenA, tokenB, fee } = generated.object as z.infer<
				typeof GetPoolDetailsActionSchema
			>;
			elizaLogger.info("Extracted get pool liquidity parameters:", {
				tokenA,
				tokenB,
				fee,
			});

			const plugin = nebyPlugin(runtime);

			const liquidity = await plugin.getPoolLiquidity(tokenA, tokenB, fee);

			const response: Content = {
				text: `Current liquidity for ${tokenA}/${tokenB} (Fee: ${fee ?? POOL_FEES.MEDIUM}): ${liquidity}.`,
				result: liquidity,
			};
			if (callback) callback(response, []);
		} catch (error) {
			elizaLogger.error("Error in NEBY_GET_POOL_LIQUIDITY handler:", error);
			if (callback)
				callback(
					{
						text: `Failed to get pool liquidity: ${error instanceof Error ? error.message : "Unknown error"}`,
					},
					[],
				);
		}
	},
};

export const getPoolInfoAction: Action = {
	name: "NEBY_GET_POOL_INFO",
	description: "Get detailed information about a Neby DEX pool.",
	validate,
	similes: ["NEBY_POOL_DETAILS", "NEBY_GET_POOL_STATS", "NEBY_INSPECT_POOL"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Neby Get the details for the ROSE/USDC 0.3% fee pool on Neby.",
					actions: [
						{
							name: "NEBY_GET_POOL_INFO",
							options: {
								tokenA: "0x...ROSE_ADDRESS...",
								tokenB: "0x...USDC_ADDRESS...",
								fee: 3000,
							},
						},
					],
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Neby Pool Details (ROSE/USDC 0.3%):\n- Current Price (Tick): ...\n- Liquidity: ...\n- Fees Generated (24h): ...\n- Volume (24h): ...",
					result: {
						poolAddress: "0x...pool_address...",
						token0: "0x...USDC_ADDRESS...",
						token1: "0x...ROSE_ADDRESS...",
						fee: 3000,
						tickCurrent: 12345,
						liquidity: "1500000000000000000000000",
					},
				},
			},
		],
	],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State | undefined,
		_options: unknown,
		callback?: HandlerCallback,
	) => {
		elizaLogger.debug("Starting NEBY_GET_POOL_INFO action handler...");
		try {
			if (!state) {
				throw new Error("Action handler called without state.");
			}
			const context = composeContext({
				state,
				template: getPoolDetailsTemplate,
			});
			const generated = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: GetPoolDetailsActionSchema,
			});

			if (!generated.object) {
				throw new Error("Failed to extract pool details parameters.");
			}

			const { tokenA, tokenB, fee } = generated.object as z.infer<
				typeof GetPoolDetailsActionSchema
			>;
			elizaLogger.info("Extracted get pool info parameters:", {
				tokenA,
				tokenB,
				fee,
			});

			const plugin = nebyPlugin(runtime);

			const poolInfo = await plugin.getPoolInfo(tokenA, tokenB, fee);

			const formattedInfo = Object.entries(poolInfo)
				.map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
				.join("\n");

			const response: Content = {
				text: `Details for pool ${tokenA}/${tokenB} (Fee: ${fee ?? POOL_FEES.MEDIUM}):\n${formattedInfo}`,
				result: poolInfo,
			};
			if (callback) callback(response, []);
		} catch (error) {
			elizaLogger.error("Error in NEBY_GET_POOL_INFO handler:", error);
			if (callback)
				callback(
					{
						text: `Failed to get pool info: ${error instanceof Error ? error.message : "Unknown error"}`,
					},
					[],
				);
		}
	},
};
