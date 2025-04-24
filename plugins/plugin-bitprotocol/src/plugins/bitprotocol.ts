import {
	type Action,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	type State,
	elizaLogger,
} from "@elizaos/core";
import { ContractHelper } from "@realityspiral/plugin-coinbase";

import {
	BITPROTOCOL_CONTRACTS,
	BORROWER_OPERATIONS_ABI,
	COLLATERAL_TOKENS,
	ERC20_ABI,
	NETWORK_CONFIG,
	PRICE_FEED_ABI,
	PRIVACY_CONFIG,
	ROUTER_ABI,
	STABILITY_POOL_ABI,
	TOKEN_ADDRESSES,
	TROVE_MANAGER_ABI,
} from "../constants";
// Import types and schemas
import {
	type GetOptimalSwapPathInput,
	GetOptimalSwapPathInputSchema,
	type PriceStabilityInfo,
	type PrivateSwapInput,
	PrivateSwapInputSchema,
	type SwapInput,
	SwapInputSchema,
	type SwapPath,
	type SwapResult,
} from "../types";
import { formatTokenAmount, parseTokenAmount } from "../utils";

// --- Internal Configuration Helper --- //

interface PluginSettings {
	rpcUrl: string;
	networkId: string;
	defaultSlippage: number;
	privacyEnabled: boolean;
}

/**
 * Retrieves and validates necessary settings from the runtime.
 */
function getConfig(runtime: IAgentRuntime): PluginSettings {
	const rpcUrl =
		runtime.getSetting("BITPROTOCOL_RPC_URL") ||
		NETWORK_CONFIG.OASIS_SAPPHIRE.rpcUrl;
	const networkId =
		runtime.getSetting("BITPROTOCOL_NETWORK_ID") ||
		NETWORK_CONFIG.OASIS_SAPPHIRE.chainId.toString();
	const defaultSlippage = Number.parseFloat(
		runtime.getSetting("BITPROTOCOL_MAX_SLIPPAGE") || "0.005",
	);
	const privacyEnabled =
		runtime.getSetting("BITPROTOCOL_PRIVACY_ENABLED") !== "false";

	if (!rpcUrl) {
		throw new Error("Missing required setting: BITPROTOCOL_RPC_URL");
	}

	return {
		rpcUrl,
		networkId,
		defaultSlippage,
		privacyEnabled,
	};
}

// --- Swap Action --- //

const handleSwap: Action["handler"] = async (
	runtime: IAgentRuntime,
	message: Memory,
	state?: State,
	options?: unknown,
	callback?: HandlerCallback,
): Promise<SwapResult> => {
	elizaLogger.info("Executing bitProtocol.swap action", { options });
	const config = getConfig(runtime);

	try {
		// Validate input from options using Zod schema
		const validationResult = SwapInputSchema.safeParse(options);
		if (!validationResult.success) {
			throw new Error(
				`Invalid input options: ${validationResult.error.message}`,
			);
		}
		const { fromTokenSymbol, toTokenSymbol, amountStr, slippage } =
			validationResult.data;

		// --- Initialize ContractHelper ---
		const contractHelper = new ContractHelper(runtime);

		const currentSlippage = slippage ?? config.defaultSlippage;
		elizaLogger.info(`Using slippage: ${currentSlippage * 100}%`);

		// --- Input Validation & Parsing ---
		const fromTokenAddress = TOKEN_ADDRESSES[fromTokenSymbol];
		const toTokenAddress = TOKEN_ADDRESSES[toTokenSymbol];
		if (!fromTokenAddress || !toTokenAddress) {
			throw new Error(
				`Unsupported token symbol(s): ${fromTokenSymbol}, ${toTokenAddress}`,
			);
		}

		// Parse amount using updated parseTokenAmount that uses ContractHelper
		const amountParsed = await parseTokenAmount(
			amountStr,
			fromTokenAddress,
			contractHelper,
			config.networkId,
		);

		// --- Contract Interaction --- //
		// 1. Approve (if necessary)
		if (fromTokenSymbol !== "ROSE") {
			// ROSE is native on Sapphire
			elizaLogger.info(
				`Approving ${amountStr} ${fromTokenSymbol} for BorrowerOperations...`,
			);

			const approveTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: fromTokenAddress,
				method: "approve",
				args: [
					BITPROTOCOL_CONTRACTS.BorrowerOperations,
					amountParsed.toString(),
				],
				abi: ERC20_ABI,
			});

			elizaLogger.info(
				`Approval transaction sent: ${approveTx.transactionLink}`,
			);
		}

		// 2. Get optimal swap path if using DEX-style swap
		let optimalPath: string[] = [];
		let estimatedOutput = "0";

		try {
			const pathResult = await contractHelper.readContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.MultiCollateralHintHelpers,
				method: "getOptimalPath",
				args: [fromTokenAddress, toTokenAddress, amountParsed.toString()],
				abi: ROUTER_ABI,
			});

			optimalPath = pathResult.path || [fromTokenAddress, toTokenAddress];
			estimatedOutput = pathResult.estimatedOutput || "0";
			elizaLogger.info(
				`Found optimal swap path with estimated output: ${estimatedOutput}`,
			);
		} catch (pathError) {
			elizaLogger.warn(
				`Could not determine optimal path, using direct swap: ${pathError}`,
			);
			// Default to direct path if optimal path can't be determined
			optimalPath = [fromTokenAddress, toTokenAddress];
		}

		// 3. Calculate minimum output based on slippage
		const minOutput =
			BigInt(estimatedOutput) -
			(BigInt(estimatedOutput) * BigInt(Math.floor(currentSlippage * 10000))) /
				BigInt(10000);

		// 4. Execute the swap
		elizaLogger.info(`Executing BitProtocol swap operation...`);
		const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour deadline

		let swapTx;
		if (config.privacyEnabled && PRIVACY_CONFIG.TEE_ENABLED) {
			elizaLogger.info("Using privacy-preserving swap...");
			// Generate nonce for confidentiality
			const nonce = BigInt(Math.floor(Math.random() * 1000000000)).toString();

			// Get user address
			const userAddress = await contractHelper.getUserAddress();

			swapTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.BorrowerOperations,
				method: "confidentialSwap",
				args: [fromTokenAddress, amountParsed.toString(), userAddress, nonce],
				abi: BORROWER_OPERATIONS_ABI,
				gasLimit: PRIVACY_CONFIG.MINIMUM_GAS_FOR_PRIVACY, // Higher gas limit for privacy operations
			});
		} else {
			// Standard swap
			swapTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.BitVault,
				method: "swap",
				args: [
					fromTokenAddress,
					toTokenAddress,
					amountParsed.toString(),
					minOutput.toString(),
					deadline,
				],
				abi: ROUTER_ABI,
			});
		}

		elizaLogger.info(`Swap transaction sent: ${swapTx.transactionLink}`);

		// Extract transaction hash from transaction link
		const txHash = swapTx.transactionLink.includes("/")
			? swapTx.transactionLink.split("/").pop() || swapTx.transactionLink
			: swapTx.transactionLink;

		const result: SwapResult = {
			transactionHash: txHash,
			fromAmountFormatted: amountStr,
			estimatedOutputFormatted: await formatTokenAmount(
				BigInt(estimatedOutput),
				toTokenAddress,
				contractHelper,
				config.networkId,
			),
			path: optimalPath.map((addr) => {
				// Find token symbol from address
				for (const [symbol, address] of Object.entries(TOKEN_ADDRESSES)) {
					if (address.toLowerCase() === addr.toLowerCase()) {
						return symbol;
					}
				}
				return addr; // Return address if symbol not found
			}),
		};

		if (callback)
			callback({
				text: `Swap initiated: ${amountStr} ${fromTokenSymbol} to approximately ${result.estimatedOutputFormatted} ${toTokenSymbol}. Transaction: ${txHash}`,
			});

		return result;
	} catch (error: unknown) {
		elizaLogger.error(
			`bitProtocol.swap action failed: ${error instanceof Error ? error.message : String(error)}`,
			{
				error: error instanceof Error ? error?.stack : error,
			},
		);
		if (callback)
			callback({
				text: `Swap failed: ${error instanceof Error ? error.message : String(error)}`,
			});
		throw error; // Re-throw error to be handled by the agent runtime
	}
};

export const swapAction: Action = {
	name: "bitProtocol.swap",
	description:
		"Performs a stablecoin swap on Oasis Sapphire using BitProtocol.",
	handler: handleSwap,
	similes: ["swap tokens", "exchange assets", "trade BitUSD"],
	examples: [
		// Example 1
		[
			{
				user: "{{user1}}",
				content: { text: "Swap 100 ROSE for BitUSD" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Initiating swap for 100 ROSE to BitUSD via BitProtocol...",
					action: "bitProtocol.swap",
				},
			},
		],
		// Example 2
		[
			{
				user: "{{user1}}",
				content: { text: "trade 50.5 BitUSD for wstROSE with 0.5% slippage" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Okay, swapping 50.5 BitUSD for wstROSE with 0.5% slippage limit.",
					action: "bitProtocol.swap",
				},
			},
		],
	],
	validate: async (options: unknown): Promise<boolean> => {
		const result = SwapInputSchema.safeParse(options);
		if (!result.success) {
			elizaLogger.warn(
				"Swap action validation failed:",
				result.error.flatten(),
			);
		}
		return result.success;
	},
};

// --- Private Swap Action --- //

const handlePrivateSwap: Action["handler"] = async (
	runtime: IAgentRuntime,
	message: Memory,
	state?: State,
	options?: unknown,
	callback?: HandlerCallback,
): Promise<SwapResult> => {
	elizaLogger.info("Executing bitProtocol.privateSwap action", { options });
	const config = getConfig(runtime);

	// Verify that privacy features are available
	if (!PRIVACY_CONFIG.TEE_ENABLED) {
		throw new Error(
			"Privacy features are not available. TEE environment required for private swaps.",
		);
	}

	try {
		// Validate input from options using Zod schema
		const validationResult = PrivateSwapInputSchema.safeParse(options);
		if (!validationResult.success) {
			throw new Error(
				`Invalid input options: ${validationResult.error.message}`,
			);
		}
		const { fromTokenSymbol, toTokenSymbol, amountStr, slippage } =
			validationResult.data;

		// --- Initialize ContractHelper ---
		const contractHelper = new ContractHelper(runtime);

		const currentSlippage = slippage ?? config.defaultSlippage;
		elizaLogger.info(`Using slippage: ${currentSlippage * 100}%`);

		// --- Input Validation & Parsing ---
		const fromTokenAddress = TOKEN_ADDRESSES[fromTokenSymbol];
		const toTokenAddress = TOKEN_ADDRESSES[toTokenSymbol];
		if (!fromTokenAddress || !toTokenAddress) {
			throw new Error(
				`Unsupported token symbol(s): ${fromTokenSymbol}, ${toTokenAddress}`,
			);
		}

		// Parse amount using updated parseTokenAmount
		const amountParsed = await parseTokenAmount(
			amountStr,
			fromTokenAddress,
			contractHelper,
			config.networkId,
		);

		// --- Contract Interaction --- //
		// 1. Approve (if necessary)
		if (fromTokenSymbol !== "ROSE") {
			elizaLogger.info(
				`Approving ${amountStr} ${fromTokenSymbol} for confidential operations...`,
			);

			const approveTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: fromTokenAddress,
				method: "approve",
				args: [BITPROTOCOL_CONTRACTS.BitVault, amountParsed.toString()],
				abi: ERC20_ABI,
				confidential: true, // Use confidential transactions if available
			});

			elizaLogger.info(
				`Confidential approval transaction sent: ${approveTx.transactionLink}`,
			);
		}

		// 2. Calculate minimum output based on slippage (estimate is less accurate in private mode)
		const estimatedOutputRaw =
			(BigInt(amountParsed) * BigInt(95)) / BigInt(100); // 5% discount as estimation
		const minOutput =
			estimatedOutputRaw -
			(estimatedOutputRaw * BigInt(Math.floor(currentSlippage * 10000))) /
				BigInt(10000);

		// 3. Execute the private swap
		elizaLogger.info(`Executing BitProtocol private swap operation...`);
		const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour deadline

		// Create encrypted data payload for privacy
		const userAddress = await contractHelper.getUserAddress();
		const nonce = BigInt(Math.floor(Math.random() * 1000000000)).toString();
		const encryptedData = Buffer.from(
			JSON.stringify({
				sender: userAddress,
				nonce: nonce,
			}),
		).toString("base64");

		const swapTx = await contractHelper.invokeContract({
			networkId: config.networkId,
			contractAddress: BITPROTOCOL_CONTRACTS.BitVault,
			method: "privateSwap",
			args: [
				fromTokenAddress,
				toTokenAddress,
				amountParsed.toString(),
				minOutput.toString(),
				deadline,
				encryptedData,
			],
			abi: ROUTER_ABI,
			gasLimit: PRIVACY_CONFIG.MINIMUM_GAS_FOR_PRIVACY, // Higher gas limit for privacy operations
			confidential: true,
		});

		elizaLogger.info(
			`Private swap transaction sent: ${swapTx.transactionLink}`,
		);

		// Extract transaction hash from transaction link
		const txHash = swapTx.transactionLink.includes("/")
			? swapTx.transactionLink.split("/").pop() || swapTx.transactionLink
			: swapTx.transactionLink;

		const result: SwapResult = {
			transactionHash: txHash,
			fromAmountFormatted: amountStr,
			isConfidential: true,
		};

		if (callback)
			callback({
				text: `Private swap initiated: ${amountStr} ${fromTokenSymbol} to ${toTokenSymbol}. Transaction details are confidential.`,
			});

		return result;
	} catch (error: unknown) {
		elizaLogger.error(
			`bitProtocol.privateSwap action failed: ${error instanceof Error ? error.message : String(error)}`,
			{
				error: error instanceof Error ? error?.stack : error,
			},
		);
		if (callback)
			callback({
				text: `Private swap failed: ${error instanceof Error ? error.message : String(error)}`,
			});
		throw error;
	}
};

export const privateSwapAction: Action = {
	name: "bitProtocol.privateSwap",
	description:
		"Performs a privacy-preserving stablecoin swap on Oasis Sapphire using BitProtocol's confidential features.",
	handler: handlePrivateSwap,
	similes: ["private swap", "confidential exchange", "privacy swap"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: { text: "Swap 50 ROSE for BitUSD privately" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Initiating private swap for 50 ROSE to BitUSD with confidentiality...",
					action: "bitProtocol.privateSwap",
				},
			},
		],
	],
	validate: async (options: unknown): Promise<boolean> => {
		const result = PrivateSwapInputSchema.safeParse(options);
		if (!result.success) {
			elizaLogger.warn(
				"Private swap action validation failed:",
				result.error.flatten(),
			);
		}
		return result.success;
	},
};

// --- Monitor Price Stability Action --- //

const handleMonitorPriceStability: Action["handler"] = async (
	runtime: IAgentRuntime,
	message: Memory,
	state?: State,
	options?: unknown,
	callback?: HandlerCallback,
): Promise<PriceStabilityInfo> => {
	elizaLogger.info("Executing bitProtocol.monitorPriceStability action");
	const config = getConfig(runtime);

	try {
		// --- Initialize ContractHelper ---
		const contractHelper = new ContractHelper(runtime);

		// --- Contract Interaction --- //
		// Call the price function
		elizaLogger.info("Fetching price from PriceFeed contract...");

		const priceBigInt = await contractHelper.readContract({
			networkId: config.networkId,
			contractAddress: BITPROTOCOL_CONTRACTS.PriceFeed,
			method: "lastGoodPrice",
			args: [],
			abi: PRICE_FEED_ABI,
		});

		// Format the price using our formatTokenAmount function
		const priceString = await formatTokenAmount(
			BigInt(priceBigInt.toString()),
			BITPROTOCOL_CONTRACTS.DebtToken, // BitUSDs token
			contractHelper,
			config.networkId,
		);

		elizaLogger.info(`Current price from feed: ${priceString}`);

		// --- Stability Logic --- //
		const priceNum = Number.parseFloat(priceString);
		const lowerBound = 0.99; // Example threshold
		const upperBound = 1.01; // Example threshold
		const isStable = priceNum >= lowerBound && priceNum <= upperBound;

		const result: PriceStabilityInfo = {
			price: priceString,
			isStable: isStable,
			timestamp: Date.now(),
		};
		if (callback)
			callback({
				text: `BitProtocol price: ${priceString} (Stable: ${isStable ? "Yes" : "No"})`,
			});
		return result;
	} catch (error: unknown) {
		elizaLogger.error(
			`bitProtocol.monitorPriceStability action failed: ${error instanceof Error ? error.message : String(error)}`,
			{ error: error instanceof Error ? error?.stack : error },
		);
		if (callback)
			callback({
				text: `Price check failed: ${error instanceof Error ? error.message : String(error)}`,
			});
		throw error;
	}
};

export const monitorPriceStabilityAction: Action = {
	name: "bitProtocol.monitorPriceStability",
	description: "Monitors BitProtocol stablecoin price and stability status.",
	handler: handleMonitorPriceStability,
	similes: ["check price", "monitor stability", "check peg"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: { text: "Is BitUSD stable right now?" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Let me check the BitUSD price stability for you...",
					action: "bitProtocol.monitorPriceStability",
				},
			},
		],
	],
	validate: async (options: unknown): Promise<boolean> => {
		const result = MonitorPriceStabilityInputSchema.safeParse(options);
		if (!result.success) {
			elizaLogger.warn(
				"Price stability validation failed:",
				result.error.flatten(),
			);
		}
		return result.success;
	},
};

// --- Get Optimal Swap Path Action --- //

const handleGetOptimalSwapPath: Action["handler"] = async (
	runtime: IAgentRuntime,
	message: Memory,
	state?: State,
	options?: unknown,
	callback?: HandlerCallback,
): Promise<SwapPath> => {
	elizaLogger.info("Executing bitProtocol.getOptimalSwapPath action", {
		options,
	});
	const config = getConfig(runtime);

	// Re-validate here or ensure options is correctly typed if accessed directly
	// For safety, parsing again:
	const validationResult = GetOptimalSwapPathInputSchema.safeParse(options);
	if (!validationResult.success) {
		throw new Error(`Invalid input options: ${validationResult.error.message}`);
	}
	const { fromTokenSymbol, toTokenSymbol, amountStr } = validationResult.data;

	try {
		// --- Initialize ContractHelper ---
		const contractHelper = new ContractHelper(runtime);

		// --- Input Validation ---
		const fromTokenAddress = TOKEN_ADDRESSES[fromTokenSymbol];
		const toTokenAddress = TOKEN_ADDRESSES[toTokenSymbol];
		if (!fromTokenAddress || !toTokenAddress) {
			throw new Error(
				`Unsupported token symbol(s): ${fromTokenSymbol}, ${toTokenAddress}`,
			);
		}

		// Parse amount
		const amountParsed = await parseTokenAmount(
			amountStr,
			fromTokenAddress,
			contractHelper,
			config.networkId,
		);

		// --- Path Calculation --- //
		elizaLogger.info("Calculating optimal swap path...");

		let pathResult;
		try {
			pathResult = await contractHelper.readContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.MultiCollateralHintHelpers,
				method: "getOptimalPath",
				args: [fromTokenAddress, toTokenAddress, amountParsed.toString()],
				abi: ROUTER_ABI,
			});
		} catch (pathError) {
			elizaLogger.warn(
				`Could not determine optimal path from contract: ${pathError}`,
			);

			// Fallback logic if contract call fails
			if (fromTokenSymbol === "BitUSD" || toTokenSymbol === "BitUSD") {
				// Direct path if one token is BitUSD
				pathResult = {
					path: [fromTokenAddress, toTokenAddress],
					estimatedOutput: (
						(BigInt(amountParsed) * BigInt(95)) /
						BigInt(100)
					).toString(), // 95% estimate
				};
			} else {
				// Path through BitUSD for other tokens
				pathResult = {
					path: [fromTokenAddress, TOKEN_ADDRESSES.BitUSD, toTokenAddress],
					estimatedOutput: (
						(BigInt(amountParsed) * BigInt(90)) /
						BigInt(100)
					).toString(), // 90% estimate for two hops
				};
			}
		}

		// Format output
		const formattedOutput = await formatTokenAmount(
			BigInt(pathResult.estimatedOutput),
			toTokenAddress,
			contractHelper,
			config.networkId,
		);

		// Convert addresses in path to token symbols
		const symbolPath = pathResult.path.map((addr: string) => {
			// Find token symbol from address
			for (const [symbol, address] of Object.entries(TOKEN_ADDRESSES)) {
				if (address.toLowerCase() === addr.toLowerCase()) {
					return symbol;
				}
			}
			return addr; // Return address if symbol not found
		});

		const result: SwapPath = {
			path: symbolPath,
			estimatedOutput: pathResult.estimatedOutput,
			formattedOutput: formattedOutput,
			inputAmount: amountStr,
			fromSymbol: fromTokenSymbol,
			toSymbol: toTokenSymbol,
		};

		if (callback)
			callback({
				text: `Optimal path: ${amountStr} ${fromTokenSymbol} → ${symbolPath.join(" → ")} with estimated output of ${formattedOutput} ${toTokenSymbol}`,
			});

		return result;
	} catch (error: unknown) {
		elizaLogger.error(
			`bitProtocol.getOptimalSwapPath action failed: ${error instanceof Error ? error.message : String(error)}`,
			{ error: error instanceof Error ? error?.stack : error },
		);
		if (callback)
			callback({
				text: `Failed to calculate optimal path: ${error instanceof Error ? error.message : String(error)}`,
			});
		throw error;
	}
};

export const getOptimalSwapPathAction: Action = {
	name: "bitProtocol.getOptimalSwapPath",
	description:
		"Calculates the optimal swap path between tokens on BitProtocol.",
	handler: handleGetOptimalSwapPath,
	similes: ["find best path", "calculate swap route", "get exchange path"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: { text: "What's the best way to swap 50 ROSE to BitUSD?" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Let me calculate the optimal path for swapping 50 ROSE to BitUSD...",
					action: "bitProtocol.getOptimalSwapPath",
				},
			},
		],
	],
	validate: async (
		runtime: IAgentRuntime,
		options: unknown,
	): Promise<boolean> => {
		const result = GetOptimalSwapPathInputSchema.safeParse(options);
		if (!result.success) {
			elizaLogger.warn(
				"Optimal path calculation validation failed:",
				result.error.flatten(),
			);
		}
		return result.success;
	},
};

// --- Export all actions --- //
export const bitProtocolPlugin = {
	name: "BitProtocol Plugin",
	description:
		"Privacy-focused stablecoin operations on Oasis Sapphire network",
	version: "1.0.0",
	actions: [
		swapAction,
		privateSwapAction,
		monitorPriceStabilityAction,
		getOptimalSwapPathAction,
	],
};
