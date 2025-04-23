import { z } from "zod";
import {
	type Action,
	type IAgentRuntime,
	type Memory,
	type State,
	type HandlerCallback,
	elizaLogger,
} from "@elizaos/core";
import { ethers } from "ethers";
import {
	BITPROTOCOL_CONTRACTS,
	ERC20_ABI,
	BORROWER_OPERATIONS_ABI,
	PRICE_FEED_ABI,
	TOKEN_ADDRESSES,
} from "../constants";
import { initializeEthers, getContract, parseTokenAmount } from "../utils";

// --- Swap Action --- //

// Input schema for the swap action
const SwapInputSchema = z.object({
	fromTokenSymbol: z.string().min(1, "Source token symbol is required"),
	toTokenSymbol: z.string().min(1, "Destination token symbol is required"),
	amountStr: z.string().min(1, "Amount to swap is required"),
	slippage: z.number().min(0).max(1).optional(), // Optional slippage override
});

type SwapInput = z.infer<typeof SwapInputSchema>;

// Output type for the swap action (adjust as needed)
interface SwapResult {
	transactionHash: string;
	fromAmountFormatted: string;
	// toAmountFormatted might be hard to get without waiting for receipt and parsing logs
}

// Handler function for the swap action
const handleSwap: Action["handler"] = async (
	runtime: IAgentRuntime,
	message: Memory,
	state?: State,
	options?: any, // Input parameters expected here
	callback?: HandlerCallback,
): Promise<SwapResult> => {
	elizaLogger.info("Executing bitProtocol.swap action", { options });

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

		// --- Configuration & Initialization ---
		const rpcUrl = runtime.getSetting("BITPROTOCOL_RPC_URL");
		const privateKey = runtime.getSetting("BITPROTOCOL_PRIVATE_KEY");
		const defaultSlippage = Number.parseFloat(
			runtime.getSetting("BITPROTOCOL_MAX_SLIPPAGE") || "0.005",
		);
		const network =
			runtime.getSetting("BITPROTOCOL_OASIS_NETWORK") || "mainnet"; // Example

		if (!rpcUrl || !privateKey) {
			throw new Error(
				"Missing required settings: BITPROTOCOL_RPC_URL or BITPROTOCOL_PRIVATE_KEY",
			);
		}

		// Initialize ethers using runtime settings
		const { provider, signer } = initializeEthers({
			// Assuming initializeEthers takes config object
			oasisNetwork: network,
			rpcUrl: rpcUrl,
			privateKey: privateKey,
		});

		const currentSlippage = slippage ?? defaultSlippage;
		elizaLogger.info(`Using slippage: ${currentSlippage * 100}%`);

		// --- Input Validation & Parsing ---
		const fromTokenAddress = TOKEN_ADDRESSES[fromTokenSymbol];
		const toTokenAddress = TOKEN_ADDRESSES[toTokenSymbol];
		if (!fromTokenAddress || !toTokenAddress) {
			throw new Error(
				`Unsupported token symbol(s): ${fromTokenSymbol}, ${toTokenAddress}`,
			);
		}
		const amountParsed = await parseTokenAmount(
			amountStr,
			fromTokenAddress,
			provider,
		);

		// --- Contract Interaction --- //
		const borrowerOpsContract = getContract(
			BITPROTOCOL_CONTRACTS.BorrowerOperations,
			BORROWER_OPERATIONS_ABI,
			signer,
		);

		// 1. Approve (if necessary)
		if (fromTokenSymbol !== "ROSE") {
			// TODO: Check if ROSE is native on Sapphire
			const tokenContract = getContract(fromTokenAddress, ERC20_ABI, signer);
			elizaLogger.info(
				`Approving ${amountStr} ${fromTokenSymbol} for BorrowerOperations...`,
			);
			const approveTx = await tokenContract.approve(
				BITPROTOCOL_CONTRACTS.BorrowerOperations,
				amountParsed,
			);
			// Consider waiting for approval, but adds latency
			// await approveTx.wait();
			elizaLogger.info(`Approval transaction sent: ${approveTx.hash}`);
		}

		// 2. Execute Swap (Placeholder Logic)
		elizaLogger.info("Executing BitProtocol swap operation (Placeholder)... ");
		// IMPORTANT: Replace with actual BitProtocol swap call using correct ABI and parameters
		// This likely involves borrowerOpsContract.adjustTrove, .repayDebt, or a specific swap function.
		// Hints and fee parameters will be needed.
		console.warn(
			"BitProtocol swap logic is a placeholder and needs actual implementation!",
		);
		// Simulating a transaction response
		const tx = {
			hash: `0x_placeholder_swap_tx_${Date.now()}`,
		} as ethers.ContractTransactionResponse;
		elizaLogger.info(`Swap transaction sent: ${tx.hash}`);

		const result: SwapResult = {
			transactionHash: tx.hash,
			fromAmountFormatted: amountStr,
		};
		if (callback) callback({ text: `Swap initiated: ${tx.hash}` });
		return result;
	} catch (error: any) {
		elizaLogger.error(`bitProtocol.swap action failed: ${error.message}`, {
			error: error?.stack || error,
		});
		if (callback) callback({ text: `Swap failed: ${error.message}` });
		throw error; // Re-throw error to be handled by the agent runtime
	}
};

// Export the Action object
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
				// Note: Options are typically derived by the LLM based on text,
				// not explicitly part of the example message content itself
				// but the handler expects them in the 'options' argument.
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Initiating swap for 100 ROSE to BitUSD via BitProtocol...",
					action: "bitProtocol.swap",
					// Agent might confirm parsed options here if needed
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
	validate: async (options: any): Promise<boolean> => {
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

// --- Monitor Price Stability Action --- //

// No input schema needed for basic price monitoring

interface PriceStabilityInfo {
	price: string;
	isStable: boolean;
	// timestamp: number; // Consider adding
}

const handleMonitorPriceStability: Action["handler"] = async (
	runtime: IAgentRuntime,
	message: Memory,
	state?: State,
	options?: any,
	callback?: HandlerCallback,
): Promise<PriceStabilityInfo> => {
	elizaLogger.info("Executing bitProtocol.monitorPriceStability action");

	try {
		// --- Configuration & Initialization ---
		const rpcUrl = runtime.getSetting("BITPROTOCOL_RPC_URL");
		const network =
			runtime.getSetting("BITPROTOCOL_OASIS_NETWORK") || "mainnet";
		// No private key needed for read-only calls
		if (!rpcUrl) {
			throw new Error("Missing required setting: BITPROTOCOL_RPC_URL");
		}
		const provider = new ethers.JsonRpcProvider(rpcUrl);
		// Note: If initializeEthers requires privateKey, we need a separate util or direct provider creation here.
		// Using direct creation for simplicity now:
		// const { provider } = initializeEthers({ oasisNetwork: network, rpcUrl: rpcUrl, privateKey: '0x' + '0'.repeat(64) }); // Dummy PK if util requires

		// --- Contract Interaction --- //
		const priceFeedContract = getContract(
			BITPROTOCOL_CONTRACTS.PriceFeed,
			PRICE_FEED_ABI,
			provider,
		);

		// Call the price function - adjust function name based on actual ABI
		elizaLogger.info("Fetching price from PriceFeed contract...");
		const priceBigInt: bigint = await priceFeedContract.lastGoodPrice(); // Or fetchPrice()
		const priceString = ethers.formatUnits(priceBigInt, 18); // Assuming 18 decimals
		elizaLogger.info(`Current price from feed: ${priceString}`);

		// --- Stability Logic --- //
		const priceNum = Number.parseFloat(priceString);
		const lowerBound = 0.99; // Example threshold
		const upperBound = 1.01; // Example threshold
		const isStable = priceNum >= lowerBound && priceNum <= upperBound;

		const result: PriceStabilityInfo = {
			price: priceString,
			isStable: isStable,
		};
		if (callback)
			callback({
				text: `BitProtocol price: ${priceString} (Stable: ${isStable})`,
			});
		return result;
	} catch (error: any) {
		elizaLogger.error(
			`bitProtocol.monitorPriceStability action failed: ${error.message}`,
			{ error: error?.stack || error },
		);
		if (callback) callback({ text: `Price check failed: ${error.message}` });
		throw error;
	}
};

export const monitorPriceStabilityAction: Action = {
	name: "bitProtocol.monitorPriceStability",
	description:
		"Monitors the price stability of BitProtocol stablecoins (e.g., BitUSD).",
	handler: handleMonitorPriceStability,
	similes: ["check BitUSD price", "get stablecoin price", "is BitUSD stable?"],
	examples: [
		// Example 1
		[
			{
				user: "{{user1}}",
				content: { text: "How stable is BitUSD right now?" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Checking the current price stability of BitUSD...",
					action: "bitProtocol.monitorPriceStability",
				},
			},
		],
		// Example 2
		[
			{
				user: "{{user1}}",
				content: { text: "get BitUSD price feed status" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Fetching the latest BitUSD price feed data from BitProtocol.",
					action: "bitProtocol.monitorPriceStability",
				},
			},
		],
	],
	validate: async (): Promise<boolean> => Promise.resolve(true),
};

// --- Get Optimal Swap Path Action --- //

const GetOptimalSwapPathInputSchema = z.object({
	fromTokenSymbol: z.string().min(1, "Source token symbol is required"),
	toTokenSymbol: z.string().min(1, "Destination token symbol is required"),
	amountStr: z.string().min(1, "Amount to swap is required"),
});

type GetOptimalSwapPathInput = z.infer<typeof GetOptimalSwapPathInputSchema>;

interface SwapPath {
	path: string[]; // Token symbols or addresses
	estimatedOutput: string; // Formatted string amount
}

const handleGetOptimalSwapPath: Action["handler"] = async (
	runtime: IAgentRuntime,
	message: Memory,
	state?: State,
	options?: any,
	callback?: HandlerCallback,
): Promise<SwapPath> => {
	elizaLogger.info("Executing bitProtocol.getOptimalSwapPath action", {
		options,
	});
	const { fromTokenSymbol, toTokenSymbol, amountStr } = options;

	try {
		// --- Configuration & Initialization ---
		// Read-only, might only need provider
		const rpcUrl = runtime.getSetting("BITPROTOCOL_RPC_URL");
		if (!rpcUrl) {
			throw new Error("Missing required setting: BITPROTOCOL_RPC_URL");
		}
		const provider = new ethers.JsonRpcProvider(rpcUrl);

		// --- Input Validation ---
		const fromTokenAddress = TOKEN_ADDRESSES[fromTokenSymbol];
		const toTokenAddress = TOKEN_ADDRESSES[toTokenSymbol];
		if (!fromTokenAddress || !toTokenAddress) {
			throw new Error(
				`Unsupported token symbol(s): ${fromTokenSymbol}, ${toTokenAddress}`,
			);
		}
		// Parse amount for potential calculations
		const amountParsed = await parseTokenAmount(
			amountStr,
			fromTokenAddress,
			provider,
		);

		// --- Path Calculation Logic (Placeholder) --- //
		elizaLogger.warn("Optimal path calculation logic is a placeholder.");
		// TODO: Implement actual path calculation using contracts (PriceFeed, HintHelpers?),
		// considering liquidity, fees, and potential routes (direct, via BitUSD).
		let path: string[];
		if (fromTokenSymbol === "BitUSD" || toTokenSymbol === "BitUSD") {
			path = [fromTokenSymbol, toTokenSymbol];
		} else {
			path = [fromTokenSymbol, "BitUSD", toTokenSymbol]; // Default assumption
		}

		// --- Estimate Output (Placeholder) --- //
		elizaLogger.warn("Output estimation logic is a placeholder.");
		// TODO: Implement actual output estimation based on the determined path,
		// querying necessary contracts for prices/liquidity.
		const estimatedOutput = "0"; // Placeholder value

		const result: SwapPath = {
			path: path,
			estimatedOutput: estimatedOutput,
		};
		if (callback)
			callback({
				text: `Estimated path for ${amountStr} ${fromTokenSymbol} -> ${toTokenSymbol}: ${path.join(" -> ")}, Output: ~${estimatedOutput} ${toTokenSymbol}`,
			});
		return result;
	} catch (error: any) {
		elizaLogger.error(
			`bitProtocol.getOptimalSwapPath action failed: ${error.message}`,
			{ error: error?.stack || error },
		);
		if (callback)
			callback({ text: `Path calculation failed: ${error.message}` });
		throw error;
	}
};

export const getOptimalSwapPathAction: Action = {
	name: "bitProtocol.getOptimalSwapPath",
	description:
		"Calculates the optimal swap path between two tokens using BitProtocol.",
	handler: handleGetOptimalSwapPath,
	similes: ["find best swap route", "get swap path", "estimate swap output"],
	examples: [
		// Example 1
		[
			{
				user: "{{user1}}",
				content: { text: "Find the best way to swap 1000 ROSE for mTBill" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Calculating the optimal path for swapping 1000 ROSE to mTBill...",
					action: "bitProtocol.getOptimalSwapPath",
				},
			},
		],
		// Example 2
		[
			{
				user: "{{user1}}",
				content: { text: "Estimate swapping 250 BIT to wstROSE" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Estimating the swap from 250 BIT to wstROSE using BitProtocol...",
					action: "bitProtocol.getOptimalSwapPath",
				},
			},
		],
	],
	validate: async (options: any): Promise<boolean> => {
		const result = GetOptimalSwapPathInputSchema.safeParse(options);
		if (!result.success) {
			elizaLogger.warn(
				"GetOptimalSwapPath action validation failed:",
				result.error.flatten(),
			);
		}
		return result.success;
	},
}; 