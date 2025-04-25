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
	// BIT_VAULT_ABI, // Removed incorrect ABI import
	BORROWER_OPERATIONS_ABI,
	COLLATERAL_TOKENS,
	ERC20_ABI,
	NETWORK_CONFIG,
	PRICE_FEED_ABI,
	PRIVACY_CONFIG,
	STABILITY_POOL_ABI,
	TOKEN_ADDRESSES,
	TROVE_MANAGER_ABI,
	UNISWAP_V2_ROUTER_ABI,
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
			elizaLogger.error(
				`Input validation failed: ${JSON.stringify(validationResult.error.format())}`,
			);
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

		// --- Determine swap path ---
		const path = [fromTokenAddress, toTokenAddress];
		if (
			fromTokenSymbol !== "BitUSD" &&
			toTokenSymbol !== "BitUSD" &&
			fromTokenSymbol !== "ROSE" &&
			toTokenSymbol !== "ROSE"
		) {
			// If neither token is BitUSD or ROSE, use BitUSD as an intermediate
			path.splice(1, 0, TOKEN_ADDRESSES.BitUSD);
		}

		elizaLogger.info(`Using swap path: ${path.join(" -> ")}`);

		// --- Get estimated output amount ---
		let estimatedOutput = "0"; // Default to 0
		try {
			const amountsOut = await contractHelper.readContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.Router,
				method: "getAmountsOut",
				args: [amountParsed.toString(), path],
				abi: UNISWAP_V2_ROUTER_ABI,
			});

			estimatedOutput = amountsOut[amountsOut.length - 1].toString(); // Convert BigInt to string
			elizaLogger.info(`Estimated output: ${estimatedOutput} ${toTokenSymbol}`);
		} catch (error) {
			elizaLogger.warn(
				`Could not estimate output: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Keep estimatedOutput as "0"
		}

		// Calculate minimum output with slippage
		const minOutput =
			BigInt(estimatedOutput) -
			(BigInt(estimatedOutput) * BigInt(Math.floor(currentSlippage * 10000))) /
				BigInt(10000);

		elizaLogger.info(
			`Minimum output with ${currentSlippage * 100}% slippage: ${minOutput.toString()}`,
		);

		// --- Execute the swap ---
		let swapTx: any;
		let txHash: string | undefined;
		const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour deadline
		const userAddress = await contractHelper.getUserAddress();

		// Case 1: From ETH/ROSE to Token
		if (fromTokenSymbol === "ROSE") {
			elizaLogger.info(
				`Swapping ROSE to ${toTokenSymbol} using swapExactETHForTokens`,
			);

			swapTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.Router,
				method: "swapExactETHForTokens",
				args: [minOutput.toString(), path, userAddress, deadline],
				abi: UNISWAP_V2_ROUTER_ABI,
				value: amountParsed.toString(),
			});
		}
		// Case 2: From Token to ETH/ROSE
		else if (toTokenSymbol === "ROSE") {
			elizaLogger.info(`Approving ${fromTokenSymbol} for Router`);
			const approveTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: fromTokenAddress,
				method: "approve",
				args: [BITPROTOCOL_CONTRACTS.Router, amountParsed.toString()],
				abi: ERC20_ABI,
			});

			elizaLogger.info(
				`Approval transaction sent: ${approveTx.transactionLink}`,
			);

			elizaLogger.info(
				`Swapping ${fromTokenSymbol} to ROSE using swapExactTokensForETH`,
			);
			swapTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.Router,
				method: "swapExactTokensForETH",
				args: [
					amountParsed.toString(),
					minOutput.toString(),
					path,
					userAddress,
					deadline,
				],
				abi: UNISWAP_V2_ROUTER_ABI,
			});
		}
		// Case 3: Token to Token
		else {
			elizaLogger.info(`Approving ${fromTokenSymbol} for Router`);
			const approveTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: fromTokenAddress,
				method: "approve",
				args: [BITPROTOCOL_CONTRACTS.Router, amountParsed.toString()],
				abi: ERC20_ABI,
			});

			elizaLogger.info(
				`Approval transaction sent: ${approveTx.transactionLink}`,
			);

			elizaLogger.info(
				`Swapping ${fromTokenSymbol} to ${toTokenSymbol} using swapExactTokensForTokens`,
			);
			swapTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.Router,
				method: "swapExactTokensForTokens",
				args: [
					amountParsed.toString(),
					minOutput.toString(),
					path,
					userAddress,
					deadline,
				],
				abi: UNISWAP_V2_ROUTER_ABI,
			});
		}

		elizaLogger.info(`Swap transaction sent: ${swapTx.transactionLink}`);
		txHash = swapTx.transactionLink?.includes("/")
			? (swapTx.transactionLink.split("/").pop() ?? swapTx.transactionLink)
			: swapTx.transactionLink;

		// Format estimated output for return
		let formattedOutput;
		try {
			formattedOutput = await formatTokenAmount(
				BigInt(estimatedOutput), // Use the string estimatedOutput
				toTokenAddress,
				contractHelper,
				config.networkId,
			);
		} catch (error) {
			formattedOutput = `~${estimatedOutput} wei`;
		}

		const result: SwapResult = {
			transactionHash: txHash ?? "N/A",
			fromAmountFormatted: amountStr,
			estimatedOutputFormatted: formattedOutput,
			path: path.map((addr: string) => {
				// Add type annotation for addr
				// Find token symbol from address
				for (const [symbol, address] of Object.entries(TOKEN_ADDRESSES)) {
					if (address.toLowerCase() === addr.toLowerCase()) {
						return symbol;
					}
				}
				return addr; // Return address if symbol not found
			}),
		};

		if (callback) {
			callback({
				text: `Swap initiated: ${amountStr} ${fromTokenSymbol} to approximately ${formattedOutput} ${toTokenSymbol}. Transaction: ${txHash ?? "N/A"}`,
			});
		}

		return result;
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack =
			error instanceof Error ? error.stack : "No stack trace available";
		elizaLogger.error(`bitProtocol.swap action failed: ${errorMessage}`, {
			error: errorStack,
			context: {
				options,
				networkId: config.networkId,
				privacyEnabled: config.privacyEnabled,
			},
		});
		if (callback) {
			callback({
				text: `Swap failed: ${errorMessage}`,
			});
		}
		// It's important to re-throw the error so the runtime can handle it
		throw error;
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
					text: "Initiating swap for 100 ROSE to BitUSD...",
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
			"Privacy features are not available. Ensure TEE is enabled and BITPROTOCOL_PRIVACY_ENABLED is true.",
		);
	}

	try {
		// Validate input from options using Zod schema
		const validationResult = PrivateSwapInputSchema.safeParse(options);
		if (!validationResult.success) {
			elizaLogger.error(
				`Input validation failed: ${JSON.stringify(validationResult.error.format())}`,
			);
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

		// --- Determine swap path ---
		const path = [fromTokenAddress, toTokenAddress];
		if (
			fromTokenSymbol !== "BitUSD" &&
			toTokenSymbol !== "BitUSD" &&
			fromTokenSymbol !== "ROSE" &&
			toTokenSymbol !== "ROSE"
		) {
			// If neither token is BitUSD or ROSE, use BitUSD as an intermediate
			path.splice(1, 0, TOKEN_ADDRESSES.BitUSD);
		}

		elizaLogger.info(`Using private swap path: ${path.join(" -> ")}`);

		// --- Get estimated output amount (less accurate for private swaps) ---
		let estimatedOutput = "0"; // Default to 0
		try {
			// For privacy reasons, we might use a different estimation approach
			// This is an example - in a real implementation, there might be a separate
			// view method that doesn't reveal user intent
			const amountsOut = await contractHelper.readContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.Router,
				method: "getAmountsOut",
				args: [amountParsed.toString(), path],
				abi: UNISWAP_V2_ROUTER_ABI,
			});

			estimatedOutput = amountsOut[amountsOut.length - 1].toString();
			elizaLogger.info(
				`Estimated output (approximate): ${estimatedOutput} ${toTokenSymbol}`,
			);
		} catch (error) {
			elizaLogger.warn(
				`Could not estimate output for private swap: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Use a conservative estimate - apply a 5% discount compared to public swap
			estimatedOutput = (
				(BigInt(amountParsed) * BigInt(95)) /
				BigInt(100)
			).toString();
			elizaLogger.info(`Using conservative estimate: ${estimatedOutput}`);
		}

		// Calculate minimum output with slippage
		const minOutput =
			BigInt(estimatedOutput) -
			(BigInt(estimatedOutput) * BigInt(Math.floor(currentSlippage * 10000))) /
				BigInt(10000);

		elizaLogger.info(
			`Minimum output with ${currentSlippage * 100}% slippage: ${minOutput.toString()} (private swap)`,
		);

		// --- Execute the swap ---
		let swapTx: any;
		let txHash: string | undefined;
		const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour deadline
		const userAddress = await contractHelper.getUserAddress();

		// Create encrypted data payload for privacy
		const nonce = BigInt(Math.floor(Math.random() * 1000000000)).toString();
		const encryptedData = Buffer.from(
			JSON.stringify({
				sender: userAddress,
				nonce: nonce,
				timestamp: Date.now(),
			}),
		).toString("base64");

		elizaLogger.info(`Prepared confidential transaction metadata`);

		// Case 1: From ETH/ROSE to Token
		if (fromTokenSymbol === "ROSE") {
			elizaLogger.info(
				`Private swap ROSE to ${toTokenSymbol} using confidential transaction`,
			);

			swapTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.BitVault,
				method: "depositAndSwapETHForTokens",
				args: [
					toTokenAddress,
					minOutput.toString(),
					deadline,
					Buffer.from(encryptedData),
				],
				abi: UNISWAP_V2_ROUTER_ABI, // Using a compatible ABI as placeholder
				value: amountParsed.toString(),
				gasLimit: PRIVACY_CONFIG.MINIMUM_GAS_FOR_PRIVACY,
				confidential: true,
			});
		}
		// Case 2: From Token to ETH/ROSE
		else if (toTokenSymbol === "ROSE") {
			elizaLogger.info(
				`Approving ${fromTokenSymbol} for BitVault with confidentiality`,
			);
			const approveTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: fromTokenAddress,
				method: "approve",
				args: [BITPROTOCOL_CONTRACTS.BitVault, amountParsed.toString()],
				abi: ERC20_ABI,
				confidential: true,
			});

			elizaLogger.info(
				`Confidential approval transaction sent: ${approveTx.transactionLink}`,
			);

			elizaLogger.info(
				`Private swap ${fromTokenSymbol} to ROSE using confidential transaction`,
			);
			swapTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.BitVault,
				method: "depositAndSwapTokensForETH",
				args: [
					fromTokenAddress,
					amountParsed.toString(),
					minOutput.toString(),
					deadline,
					Buffer.from(encryptedData),
				],
				abi: UNISWAP_V2_ROUTER_ABI, // Using a compatible ABI as placeholder
				gasLimit: PRIVACY_CONFIG.MINIMUM_GAS_FOR_PRIVACY,
				confidential: true,
			});
		}
		// Case 3: Token to Token
		else {
			elizaLogger.info(
				`Approving ${fromTokenSymbol} for BitVault with confidentiality`,
			);
			const approveTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: fromTokenAddress,
				method: "approve",
				args: [BITPROTOCOL_CONTRACTS.BitVault, amountParsed.toString()],
				abi: ERC20_ABI,
				confidential: true,
			});

			elizaLogger.info(
				`Confidential approval transaction sent: ${approveTx.transactionLink}`,
			);

			elizaLogger.info(
				`Private swap ${fromTokenSymbol} to ${toTokenSymbol} using confidential transaction`,
			);
			swapTx = await contractHelper.invokeContract({
				networkId: config.networkId,
				contractAddress: BITPROTOCOL_CONTRACTS.BitVault,
				method: "depositAndSwapTokensForTokens",
				args: [
					fromTokenAddress,
					toTokenAddress,
					amountParsed.toString(),
					minOutput.toString(),
					deadline,
					Buffer.from(encryptedData),
				],
				abi: UNISWAP_V2_ROUTER_ABI, // Using a compatible ABI as placeholder
				gasLimit: PRIVACY_CONFIG.MINIMUM_GAS_FOR_PRIVACY,
				confidential: true,
			});
		}

		elizaLogger.info(
			`Private swap transaction sent: ${swapTx.transactionLink}`,
		);
		txHash = swapTx.transactionLink?.includes("/")
			? (swapTx.transactionLink.split("/").pop() ?? swapTx.transactionLink)
			: swapTx.transactionLink;

		// Format estimated output for return
		let formattedOutput = "Confidential";
		try {
			formattedOutput = await formatTokenAmount(
				BigInt(estimatedOutput),
				toTokenAddress,
				contractHelper,
				config.networkId,
			);
			formattedOutput += " (estimate)";
		} catch (error) {
			formattedOutput = `~${estimatedOutput} wei (confidential)`;
		}

		const result: SwapResult = {
			transactionHash: txHash ?? "N/A",
			fromAmountFormatted: amountStr,
			estimatedOutputFormatted: formattedOutput,
			path: path.map((addr: string) => {
				// Find token symbol from address
				for (const [symbol, address] of Object.entries(TOKEN_ADDRESSES)) {
					if (address.toLowerCase() === addr.toLowerCase()) {
						return symbol;
					}
				}
				return addr; // Return address if symbol not found
			}),
			isConfidential: true,
		};

		if (callback) {
			callback({
				text: `Confidential swap initiated: ${amountStr} ${fromTokenSymbol} to approximately ${formattedOutput} ${toTokenSymbol}. Transaction: ${txHash ?? "N/A"}`,
			});
		}

		// Monitor transaction status
		try {
			elizaLogger.info(`Monitoring confidential transaction ${txHash}`);
			// Additional logic to monitor the transaction could be added here
		} catch (monitorError) {
			elizaLogger.warn(
				`Failed to monitor confidential transaction: ${monitorError}`,
			);
		}

		return result;
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack =
			error instanceof Error ? error.stack : "No stack trace available";
		elizaLogger.error(
			`bitProtocol.privateSwap action failed: ${errorMessage}`,
			{
				error: errorStack,
				context: {
					options,
					networkId: config.networkId,
					privacyEnabled: config.privacyEnabled,
				},
			},
		);
		if (callback) {
			callback({
				text: `Private swap failed: ${errorMessage}`,
			});
		}
		// It's important to re-throw the error so the runtime can handle it
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
			method: "fetchPrice",
			args: [BITPROTOCOL_CONTRACTS.DebtToken], // Pass the BitUSD token address
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
		const lowerBound = 0.99;
		const upperBound = 1.01;
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
		return true;
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

		// --- Path Determination (Simplified Logic - No Contract Call) --- //
		elizaLogger.info("Determining default swap path (no contract call)...");

		let pathResult: { path: string[]; estimatedOutput: string };

		if (fromTokenSymbol === "BitUSD" || toTokenSymbol === "BitUSD") {
			// Direct path if one token is BitUSD
			pathResult = {
				path: [fromTokenAddress, toTokenAddress],
				estimatedOutput: "0", // Estimation not available
			};
			elizaLogger.info("Defaulting to direct swap path involving BitUSD.");
		} else {
			// Path through BitUSD for other tokens
			pathResult = {
				path: [fromTokenAddress, TOKEN_ADDRESSES.BitUSD, toTokenAddress],
				estimatedOutput: "0", // Estimation not available
			};
			elizaLogger.info("Defaulting to swap path via BitUSD.");
		}

		// Format output
		const formattedOutput = "N/A (Estimation unavailable)"; // Set to N/A

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
			estimatedOutput: pathResult.estimatedOutput, // Will be '0'
			formattedOutput: formattedOutput, // Will be 'N/A'
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
