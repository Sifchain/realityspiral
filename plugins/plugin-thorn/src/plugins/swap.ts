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
import { ethers } from "ethers";
import { convertToWeiString, getProviderAndSigner } from "src/utils";
import {
	ABIS,
	MAINNET_TOKEN_ADDRESSES,
	OASIS_NETWORKS,
	SWAP_CSV_FILE_PATH,
	TESTNET_TOKEN_ADDRESSES,
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
				runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.MAINNET;

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
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				swapHistory: records.map((record: any) => ({
					timestamp: record.Timestamp,
					fromToken: record["From Token"],
					toToken: record["To Token"],
					sentAmount: record["Sent Amount"],
					receivedAmount: record["Received Amount"],
					exchangeRate: record["Exchange Rate"],
					fee: record.Fee,
					txHash: record["Transaction Hash"],
				})),
				liquidityPools: poolsResult || [],
			};
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (error: any) {
			elizaLogger.error("Error in swapProvider: ", error.message);
			return {
				swapHistory: [],
				liquidityPools: [],
			};
		}
	},
};

/**
 * Action for executing a privacy-preserving token swap
 */
export const executeSwapAction: Action = {
	name: "THORN_EXECUTE_SWAP",
	similes: [
		"THORN_MAKE_SWAP",
		"THORN_PERFORM_SWAP",
		"THORN_EXECUTE_EXCHANGE",
		"THORN_SWAP_TOKENS",
		"THORN_CONVERT_STABLECOINS",
		"THORN_EXCHANGE_TOKENS",
		"THORN_PRIVATE_SWAP",
		"THORN_SWAP",
	],
	description: "Execute a privacy-preserving token swap using Thorn Protocol",
	validate,
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State | undefined,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback?: HandlerCallback,
	) => {
		elizaLogger.debug("Starting EXECUTE_SWAP handler...");

		try {
			// Compose context and extract swap parameters
			const context = composeContext({
				state: state || ({} as State),
				template: swapTemplate,
			});

			const swapDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.LARGE,
				schema: SwapSchema,
			});

			if (!isSwapContent(swapDetails.object)) {
				callback?.(
					{
						text: "Invalid swap parameters. Please provide valid token symbols, amount, and slippage.",
					},
					[],
				);
				return;
			}

			const { fromToken, toToken, amount, slippage } = swapDetails.object;

			elizaLogger.info("Swap details:", {
				fromToken,
				toToken,
				amount,
				slippage,
			});

			// Initialize network configuration
			const network =
				runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.MAINNET;
			const _networkId = getNetworkId(runtime);

			// Get contract addresses for the network
			const contracts =
				network === OASIS_NETWORKS.MAINNET
					? THORN_CONTRACTS.MAINNET
					: THORN_CONTRACTS.TESTNET;

			// Get token addresses
			const tokenAddresses =
				network === OASIS_NETWORKS.MAINNET
					? MAINNET_TOKEN_ADDRESSES
					: TESTNET_TOKEN_ADDRESSES;

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const fromTokenAddress = (tokenAddresses as any)[fromToken].address;
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const toTokenAddress = (tokenAddresses as any)[toToken].address;

			if (!fromTokenAddress || !toTokenAddress) {
				callback?.(
					{
						text: `Invalid token symbols: ${fromToken} or ${toToken}. Please check the available tokens.`,
					},
					[],
				);
				return;
			}

			const amountWei = convertToWeiString(amount);
			elizaLogger.info("Internal swap helper", {
				amount,
				amountWei,
			});

			const { signer } = await getProviderAndSigner(
				runtime,
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				network.toUpperCase() as any,
			);

			if (!signer) {
				callback?.(
					{
						text: "Failed to get signer. Please ensure your wallet is connected.",
					},
					[],
				);
				return;
			}

			elizaLogger.info(`Using wallet address: ${signer.address}`);

			const stableSwapRouterContract = new ethers.Contract(
				contracts.STABLE_SWAP_ROUTER,
				ABIS.STABLE_SWAP_ROUTER,
				signer,
			);

			// Execute the swap
			try {
				elizaLogger.info("Executing swap", {
					path: [fromTokenAddress, toTokenAddress],
					flags: [2],
					amount: amountWei,
					minAmount: calculateMinimumOut(amountWei, slippage),
					recipient: signer.address,
				});

				// Execute swap via contract
				const swapTx = await stableSwapRouterContract.exactInputStableSwap(
					[fromTokenAddress, toTokenAddress], // swap path
					[2], // flags
					amountWei, // amount in
					calculateMinimumOut(amountWei, slippage), // minimum amount out
					signer.address, // recipient
					{
						value: amountWei,
						gasLimit: 300000,
					},
				);

				elizaLogger.info("Swap transaction sent", { hash: swapTx.hash });

				const swapReceipt = await swapTx.wait();

				elizaLogger.info("Swap transaction completed", {
					hash: swapReceipt?.hash,
					status: swapReceipt?.status,
				});

				// Log the swap to CSV
				await logSwapToCsv({
					fromToken,
					toToken,
					sentAmount: amountWei,
					receivedAmount: amountWei, // This would need to be extracted from transaction logs in a real implementation
					exchangeRate: "pending",
					fee: "pending",
					txHash: swapReceipt?.hash,
					timestamp: Date.now(),
				});

				callback?.(
					{
						text: `Successfully executed swap from ${fromToken} to ${toToken}. Transaction hash: ${swapReceipt?.hash}`,
					},
					[],
				);
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			} catch (swapError: any) {
				elizaLogger.error("Failed to execute swap:", swapError);
				callback?.(
					{
						text: `Failed to execute swap: ${swapError.message}`,
					},
					[],
				);
			}
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (error: any) {
			elizaLogger.error("Error in EXECUTE_SWAP handler:", error);
			callback?.(
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
					text: "Thorn Swap 100 ROSE to stROSE",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Successfully executed Thorn swap from USDT to DAI. Transaction hash: 0xabcd1234...",
				},
			},
		],
		[
			{
				user: "{{user2}}",
				content: {
					text: "Execute a Thorn swap from USDC to USDT with 0.03% slippage",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Successfully executed Thorn swap from USDC to USDT. Transaction hash: 0xefgh5678...",
				},
			},
		],
	],
};

/**
 * Action for getting a swap quote without executing the swap
 */
export const getSwapQuoteAction: Action = {
	name: "THORN_GET_SWAP_QUOTE",
	similes: [
		"THORN_QUOTE_SWAP",
		"THORN_ESTIMATE_SWAP",
		"THORN_CALCULATE_SWAP",
		"THORN_PREVIEW_SWAP",
		"THORN_CHECK_SWAP_RATE",
	],
	description: "Get a quote for a token swap without executing it",
	validate,
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State | undefined,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback?: HandlerCallback,
	) => {
		elizaLogger.debug("Starting THORN_GET_SWAP_QUOTE handler...");

		try {
			// Compose context and extract swap parameters
			const context = composeContext({
				state: state || ({} as State),
				template: swapTemplate,
			});

			const swapDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.LARGE,
				schema: SwapSchema,
			});

			if (!isSwapContent(swapDetails.object)) {
				callback?.(
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
				runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.MAINNET;
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

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const fromTokenAddress = (tokenAddresses as any)[fromToken];
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const toTokenAddress = (tokenAddresses as any)[toToken];

			if (!fromTokenAddress || !toTokenAddress) {
				callback?.(
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
					callback?.(
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

				callback?.(
					{
						text: `Swap Quote for ${amount} ${fromToken} to ${toToken}:
- Expected Output: ${expectedOutput} ${toToken}
- Minimum Output (with ${slippage || 0.5}% slippage): ${minimumOutput} ${toToken}
- Exchange Rate: 1 ${fromToken} = ${exchangeRate} ${toToken}`,
					},
					[],
				);
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			} catch (quoteError: any) {
				elizaLogger.error("Failed to get swap quote:", quoteError);
				callback?.(
					{
						text: `Failed to get swap quote: ${quoteError.message}`,
					},
					[],
				);
			}
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (error: any) {
			elizaLogger.error("Error in THORN_GET_SWAP_QUOTE handler:", error);
			callback?.(
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
					text: "Get a quote for swapping 100 USDT to DAI using Thorn",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Thorn Swap Quote for 100 USDT to DAI:
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
	description: "Privacy-preserving token swaps using Thorn Protocol",
	actions: [
		executeSwapAction,
		// getSwapQuoteAction,
	],
	// providers: [swapProvider],
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
					"Transaction Hash",
				],
			});
			await csvWriter.writeRecords([]);
		}

		// Read existing records
		const csvData = await fs.promises.readFile(SWAP_CSV_FILE_PATH, "utf-8");
		const _records = parse(csvData, {
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
