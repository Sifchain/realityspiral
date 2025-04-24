import fs from "node:fs";
import path from "node:path";
import {
	type Action,
	type Content,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type Plugin,
	type Provider,
	type State,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import {
	composeContext,
	traceResult,
} from "@realityspiral/plugin-instrumentation";
import { parse } from "csv-parse/sync";
import { createArrayCsvWriter } from "csv-writer";
import {
	ABIS,
	OASIS_NETWORKS,
	PRIVACY_LEVEL_VALUES,
	SWAP_CSV_FILE_PATH,
	THORN_CONTRACTS,
	THORN_DEFAULT_API_URL,
	TOKEN_ADDRESSES,
} from "../constants";
import {
	createContractHelper,
	getNetworkId,
	getUserAddressString,
} from "../helpers/contractUtils";
import { swapTemplate } from "../templates";
import { SwapSchema, isSwapContent } from "../types";

/**
 * Provider for retrieving swap history and information
 */
export const swapProvider: Provider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.debug("Starting swapProvider.get function");
		try {
			// Check if the CSV file exists; if not, create it with headers
			if (!fs.existsSync(SWAP_CSV_FILE_PATH)) {
				elizaLogger.warn("Swap CSV file not found. Creating a new one.");
				const csvWriter = createArrayCsvWriter({
					path: SWAP_CSV_FILE_PATH,
					header: [
						"Timestamp",
						"From Token",
						"To Token",
						"Sent Amount",
						"Received Amount",
						"Exchange Rate",
						"Fee",
						"Privacy Level",
						"Transaction Hash",
					],
				});
				await csvWriter.writeRecords([]); // Create an empty file with headers
				elizaLogger.info("New CSV file created with headers.");
			}

			// Read and parse the CSV file
			const csvData = await fs.promises.readFile(SWAP_CSV_FILE_PATH, "utf-8");
			const records = parse(csvData, {
				columns: true,
				skip_empty_lines: true,
			});

			elizaLogger.info(`Found ${records.length} swap records in CSV`);

			// Initialize network configuration
			const network =
				runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.TESTNET;
			const apiUrl =
				runtime.getSetting("THORN_API_URL") || THORN_DEFAULT_API_URL;

			// Create ContractHelper using our utility function
			const contractHelper = createContractHelper(runtime);

			// Get network id and contract addresses
			const networkId = getNetworkId(runtime);
			const contracts =
				network === OASIS_NETWORKS.MAINNET
					? THORN_CONTRACTS.MAINNET
					: THORN_CONTRACTS.TESTNET;

			// Get liquidity pools using StableSwapInfo contract
			const poolsResult = await contractHelper.readContract({
				networkId,
				contractAddress: contracts.STABLE_SWAP_INFO,
				method: "getAllPools",
				args: [],
				abi: ABIS.STABLE_SWAP_INFO,
			});

			return {
				swapHistory: records.map((record: any) => ({
					timestamp: record.Timestamp,
					fromToken: record["From Token"],
					toToken: record["To Token"],
					sentAmount: record["Sent Amount"],
					receivedAmount: record["Received Amount"],
					exchangeRate: record["Exchange Rate"],
					fee: record["Fee"],
					privacyLevel: record["Privacy Level"],
					txHash: record["Transaction Hash"],
				})),
				liquidityPools: poolsResult || [],
			};
		} catch (error) {
			elizaLogger.error("Error in swapProvider: ", error.message);
			return {
				swapHistory: [],
				liquidityPools: [],
			};
		}
	},
};

/**
 * Action for executing a privacy-preserving stablecoin swap
 */
export const executeSwapAction: Action = {
	name: "EXECUTE_SWAP",
	similes: [
		"MAKE_SWAP",
		"PERFORM_SWAP",
		"EXECUTE_EXCHANGE",
		"SWAP_TOKENS",
		"CONVERT_STABLECOINS",
		"EXCHANGE_TOKENS",
		"PRIVATE_SWAP",
		"THORN_SWAP",
	],
	description:
		"Execute a privacy-preserving stablecoin swap using Thorn Protocol",
	validate: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.info("Validating runtime for EXECUTE_SWAP...");
		return !!(
			runtime.getSetting("THORN_API_URL") && runtime.getSetting("OASIS_NETWORK")
		);
	},
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State,
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.debug("Starting EXECUTE_SWAP handler...");

		try {
			// Compose context and extract swap parameters
			const context = composeContext({
				state,
				template: swapTemplate,
			});

			const swapDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.LARGE,
				schema: SwapSchema,
			});

			if (!isSwapContent(swapDetails.object)) {
				callback(
					{
						text: "Invalid swap parameters. Please provide valid token symbols, amount, and slippage.",
					},
					[],
				);
				return;
			}

			const { fromToken, toToken, amount, slippage, privacyLevel } =
				swapDetails.object;

			elizaLogger.info("Swap details:", {
				fromToken,
				toToken,
				amount,
				slippage,
				privacyLevel,
			});

			// Initialize network configuration
			const network =
				runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.TESTNET;
			const networkId = getNetworkId(runtime);

			// Get contract addresses for the network
			const contracts =
				network === OASIS_NETWORKS.MAINNET
					? THORN_CONTRACTS.MAINNET
					: THORN_CONTRACTS.TESTNET;

			// Use ContractHelper directly
			const contractHelper = createContractHelper(runtime);

			// Get token addresses
			const tokenAddresses =
				network === OASIS_NETWORKS.MAINNET
					? TOKEN_ADDRESSES.MAINNET
					: TOKEN_ADDRESSES.TESTNET;

			const fromTokenAddress = tokenAddresses[fromToken];
			const toTokenAddress = tokenAddresses[toToken];

			if (!fromTokenAddress || !toTokenAddress) {
				callback(
					{
						text: `Invalid token symbols: ${fromToken} or ${toToken}. Please check the available tokens.`,
					},
					[],
				);
				return;
			}

			// Get wallet address
			const walletAddress = await getUserAddressString(runtime, networkId);

			if (!walletAddress) {
				callback(
					{
						text: "Failed to get wallet address. Please ensure your wallet is connected.",
					},
					[],
				);
				return;
			}

			elizaLogger.info(`Using wallet address: ${walletAddress}`);

			// Step 1: Approve token spending if needed
			try {
				elizaLogger.info(`Approving ${fromToken} for spending`);

				const approveResult = await contractHelper.invokeContract({
					networkId,
					contractAddress: fromTokenAddress,
					method: "approve",
					args: [contracts.STABLE_SWAP_ROUTER, amount],
					abi: ABIS.STABLE_SWAP_ROUTER, // We're using the ERC20 standard approve function
				});

				elizaLogger.info(`Approval transaction: ${approveResult.status}`);
			} catch (approveError) {
				elizaLogger.error("Failed to approve token spending:", approveError);
				callback(
					{
						text: `Failed to approve token spending: ${approveError.message}`,
					},
					[],
				);
				return;
			}

			// Step 2: Execute the swap
			try {
				// Convert privacy level to numeric value for the contract
				const privacyLevelValue =
					PRIVACY_LEVEL_VALUES[privacyLevel] || PRIVACY_LEVEL_VALUES.high;

				// Execute swap via contract helper
				const swapResult = await contractHelper.invokeContract({
					networkId,
					contractAddress: contracts.STABLE_SWAP_ROUTER,
					method: "swapExactTokensForTokens",
					args: [
						amount, // amount in
						calculateMinimumOut(amount, slippage), // minimum amount out
						[fromTokenAddress, toTokenAddress], // swap path
						walletAddress, // recipient
						Date.now() + 3600000, // deadline (1 hour from now)
						privacyLevelValue, // privacy level
					],
					abi: ABIS.STABLE_SWAP_ROUTER,
				});

				// Process result
				const txHash = swapResult.transactionLink?.split("/").pop() || "";

				// Log the swap to CSV
				await logSwapToCsv({
					fromToken,
					toToken,
					sentAmount: amount,
					receivedAmount: "pending", // This would need to be extracted from transaction logs in a real implementation
					exchangeRate: "pending",
					fee: "pending",
					txHash,
					timestamp: Date.now(),
					privacyLevel,
				});

				callback(
					{
						text: `Successfully executed swap from ${fromToken} to ${toToken}. Transaction hash: ${txHash}`,
					},
					[],
				);
			} catch (swapError) {
				elizaLogger.error("Failed to execute swap:", swapError);
				callback(
					{
						text: `Failed to execute swap: ${swapError.message}`,
					},
					[],
				);
			}
		} catch (error) {
			elizaLogger.error("Error in EXECUTE_SWAP handler:", error);
			callback(
				{
					text: `An error occurred while processing the swap: ${error.message}`,
				},
				[],
			);
		}
	},
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Swap 100 USDT to DAI with high privacy",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Successfully executed swap from USDT to DAI. Transaction hash: 0xabcd1234...",
				},
			},
		],
		[
			{
				user: "{{user2}}",
				content: {
					text: "Execute a swap from USDC to FRAX with 0.5% slippage",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Successfully executed swap from USDC to FRAX. Transaction hash: 0xefgh5678...",
				},
			},
		],
	],
};

/**
 * Action for getting a swap quote without executing the swap
 */
export const getSwapQuoteAction: Action = {
	name: "GET_SWAP_QUOTE",
	similes: [
		"QUOTE_SWAP",
		"ESTIMATE_SWAP",
		"CALCULATE_SWAP",
		"PREVIEW_SWAP",
		"CHECK_SWAP_RATE",
	],
	description: "Get a quote for a token swap without executing it",
	validate: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.info("Validating runtime for GET_SWAP_QUOTE...");
		return !!(
			runtime.getSetting("THORN_API_URL") && runtime.getSetting("OASIS_NETWORK")
		);
	},
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State,
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.debug("Starting GET_SWAP_QUOTE handler...");

		try {
			// Compose context and extract swap parameters
			const context = composeContext({
				state,
				template: swapTemplate,
			});

			const swapDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.LARGE,
				schema: SwapSchema,
			});

			if (!isSwapContent(swapDetails.object)) {
				callback(
					{
						text: "Invalid swap parameters. Please provide valid token symbols and amount.",
					},
					[],
				);
				return;
			}

			const { fromToken, toToken, amount, slippage } = swapDetails.object;

			// Initialize network configuration
			const network =
				runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.TESTNET;
			const networkId = getNetworkId(runtime);

			// Get contract addresses for the network
			const contracts =
				network === OASIS_NETWORKS.MAINNET
					? THORN_CONTRACTS.MAINNET
					: THORN_CONTRACTS.TESTNET;

			// Use ContractHelper directly
			const contractHelper = createContractHelper(runtime);

			// Get token addresses
			const tokenAddresses =
				network === OASIS_NETWORKS.MAINNET
					? TOKEN_ADDRESSES.MAINNET
					: TOKEN_ADDRESSES.TESTNET;

			const fromTokenAddress = tokenAddresses[fromToken];
			const toTokenAddress = tokenAddresses[toToken];

			if (!fromTokenAddress || !toTokenAddress) {
				callback(
					{
						text: `Invalid token symbols: ${fromToken} or ${toToken}. Please check the available tokens.`,
					},
					[],
				);
				return;
			}

			// Get quote from router contract
			try {
				// Use the StableSwapInfo contract to get the quote
				const quoteResult = await contractHelper.readContract({
					networkId,
					contractAddress: contracts.STABLE_SWAP_INFO,
					method: "getAmountsOut",
					args: [amount, [fromTokenAddress, toTokenAddress]],
					abi: ABIS.STABLE_SWAP_INFO,
				});

				if (!quoteResult || !quoteResult[1]) {
					callback(
						{
							text: "Failed to get swap quote. The requested token pair may not have sufficient liquidity.",
						},
						[],
					);
					return;
				}

				// Calculate expected output with slippage
				const expectedOutput = quoteResult[1];
				const minimumOutput = calculateMinimumOut(
					expectedOutput,
					slippage || 0.5,
				);

				// Calculate exchange rate
				const exchangeRate = (Number(expectedOutput) / Number(amount)).toFixed(
					6,
				);

				callback(
					{
						text: `Swap Quote for ${amount} ${fromToken} to ${toToken}:
- Expected Output: ${expectedOutput} ${toToken}
- Minimum Output (with ${slippage || 0.5}% slippage): ${minimumOutput} ${toToken}
- Exchange Rate: 1 ${fromToken} = ${exchangeRate} ${toToken}`,
					},
					[],
				);
			} catch (quoteError) {
				elizaLogger.error("Failed to get swap quote:", quoteError);
				callback(
					{
						text: `Failed to get swap quote: ${quoteError.message}`,
					},
					[],
				);
			}
		} catch (error) {
			elizaLogger.error("Error in GET_SWAP_QUOTE handler:", error);
			callback(
				{
					text: `An error occurred while getting the swap quote: ${error.message}`,
				},
				[],
			);
		}
	},
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Get a quote for swapping 100 USDT to DAI",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Swap Quote for 100 USDT to DAI:
- Expected Output: 99.7 DAI
- Minimum Output (with 0.5% slippage): 99.2 DAI
- Exchange Rate: 1 USDT = 0.997000 DAI`,
				},
			},
		],
	],
};

/**
 * Export the swap plugin
 */
export const thornSwapPlugin: Plugin = {
	name: "thornSwap",
	description: "Privacy-preserving stablecoin swaps using Thorn Protocol",
	actions: [executeSwapAction, getSwapQuoteAction],
	providers: [swapProvider],
};

/**
 * Helper function to log swaps to CSV
 */
async function logSwapToCsv(swapResult: {
	fromToken: string;
	toToken: string;
	sentAmount: string;
	receivedAmount: string;
	exchangeRate: string;
	fee: string;
	txHash: string;
	timestamp: number;
	privacyLevel: string;
}) {
	try {
		// Ensure directory exists
		const dir = path.dirname(SWAP_CSV_FILE_PATH);
		if (!fs.existsSync(dir)) {
			await fs.promises.mkdir(dir, { recursive: true });
		}

		// Create CSV file with headers if it doesn't exist
		if (!fs.existsSync(SWAP_CSV_FILE_PATH)) {
			const csvWriter = createArrayCsvWriter({
				path: SWAP_CSV_FILE_PATH,
				header: [
					"Timestamp",
					"From Token",
					"To Token",
					"Sent Amount",
					"Received Amount",
					"Exchange Rate",
					"Fee",
					"Privacy Level",
					"Transaction Hash",
				],
			});
			await csvWriter.writeRecords([]);
		}

		// Read existing records
		const csvData = await fs.promises.readFile(SWAP_CSV_FILE_PATH, "utf-8");
		const records = parse(csvData, {
			columns: true,
			skip_empty_lines: true,
		});

		// Append new record
		const csvWriter = createArrayCsvWriter({
			path: SWAP_CSV_FILE_PATH,
			header: [
				"Timestamp",
				"From Token",
				"To Token",
				"Sent Amount",
				"Received Amount",
				"Exchange Rate",
				"Fee",
				"Privacy Level",
				"Transaction Hash",
			],
			append: true,
		});

		const date = new Date(swapResult.timestamp);
		const formattedDate = date.toISOString();

		await csvWriter.writeRecords([
			[
				formattedDate,
				swapResult.fromToken,
				swapResult.toToken,
				swapResult.sentAmount,
				swapResult.receivedAmount,
				swapResult.exchangeRate,
				swapResult.fee,
				swapResult.privacyLevel,
				swapResult.txHash,
			],
		]);

		elizaLogger.info("Swap logged to CSV successfully");
	} catch (error) {
		elizaLogger.error("Failed to log swap to CSV:", error);
		// Don't throw, just log the error
	}
}

// Helper function to calculate minimum output amount based on slippage
function calculateMinimumOut(amount: string, slippage: number): string {
	const amountBN = BigInt(amount);
	const slippageFactor = 1000 - Math.floor(slippage * 10); // Convert percentage to basis points (e.g., 0.5% -> 995)
	return ((amountBN * BigInt(slippageFactor)) / BigInt(1000)).toString();
}
