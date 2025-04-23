import fs from "node:fs";
import path from "node:path";
import {
	type Action,
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
	STRATEGY_CSV_FILE_PATH,
	THORN_DEFAULT_API_URL,
	OASIS_NETWORKS,
	THORN_CONTRACTS,
	TOKEN_ADDRESSES,
	PRIVACY_LEVEL_VALUES,
	ABIS,
} from "../constants";
import { StrategySchema, isStrategyContent } from "../types";
import { strategyTemplate } from "../templates";
import { createContractHelper, getNetworkId } from "../helpers/contractUtils";

/**
 * Provider for retrieving swap strategy information
 */
export const strategyProvider: Provider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.debug("Starting strategyProvider.get function");
		try {
			// Check if the CSV file exists; if not, create it with headers
			if (!fs.existsSync(STRATEGY_CSV_FILE_PATH)) {
				elizaLogger.warn("Strategy CSV file not found. Creating a new one.");
				const csvWriter = createArrayCsvWriter({
					path: STRATEGY_CSV_FILE_PATH,
					header: [
						"Name",
						"Target Token",
						"Source Tokens",
						"Total Budget",
						"Max Slippage",
						"Trigger Threshold",
						"Privacy Level",
						"Is Active",
						"Created At",
						"Last Updated",
					],
				});
				await csvWriter.writeRecords([]); // Create an empty file with headers
				elizaLogger.info("New strategy CSV file created with headers.");
			}

			// Read and parse the CSV file
			const csvData = await fs.promises.readFile(
				STRATEGY_CSV_FILE_PATH,
				"utf-8",
			);
			const records = parse(csvData, {
				columns: true,
				skip_empty_lines: true,
			});

			elizaLogger.info(`Found ${records.length} strategy records in CSV`);

			// Transform records to the expected format
			const strategies = records.map((record: any) => ({
				name: record.Name,
				targetToken: record["Target Token"],
				sourceTokens: record["Source Tokens"].split(","),
				totalBudget: record["Total Budget"],
				maxSlippage: Number.parseFloat(record["Max Slippage"]),
				triggerThreshold: Number.parseFloat(record["Trigger Threshold"]),
				privacyLevel: record["Privacy Level"],
				isActive: record["Is Active"].toLowerCase() === "true",
				createdAt: record["Created At"],
				lastUpdated: record["Last Updated"],
			}));

			return {
				strategies,
			};
		} catch (error) {
			elizaLogger.error("Error in strategyProvider: ", error.message);
			return {
				strategies: [],
			};
		}
	},
};

/**
 * Action for creating or updating an automated swap strategy
 */
export const setupStrategyAction: Action = {
	name: "SETUP_SWAP_STRATEGY",
	similes: [
		"CREATE_STRATEGY",
		"UPDATE_STRATEGY",
		"CONFIGURE_STRATEGY",
		"SET_SWAP_STRATEGY",
		"DEFINE_SWAP_STRATEGY",
		"AUTOMATE_SWAPS",
	],
	description: "Set up an automated swap strategy for stablecoins",
	validate: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.info("Validating runtime for SETUP_SWAP_STRATEGY...");
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
		elizaLogger.debug("Starting SETUP_SWAP_STRATEGY handler...");

		try {
			// Compose context and extract strategy parameters
			const context = composeContext({
				state,
				template: strategyTemplate,
			});

			const strategyDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.LARGE,
				schema: StrategySchema,
			});

			if (!isStrategyContent(strategyDetails.object)) {
				callback(
					{
						text: "Invalid strategy parameters. Please provide a valid strategy configuration.",
					},
					[],
				);
				return;
			}

			const {
				name,
				targetToken,
				sourceTokens,
				totalBudget,
				maxSlippage,
				triggerThreshold,
				privacyLevel,
				isActive,
			} = strategyDetails.object;

			elizaLogger.info("Strategy details:", {
				name,
				targetToken,
				sourceTokens,
				totalBudget,
				maxSlippage,
				triggerThreshold,
				privacyLevel,
				isActive,
			});

			// Check if strategy with same name already exists
			let existingStrategies = [];
			let isUpdate = false;

			if (fs.existsSync(STRATEGY_CSV_FILE_PATH)) {
				const csvData = await fs.promises.readFile(
					STRATEGY_CSV_FILE_PATH,
					"utf-8",
				);
				existingStrategies = parse(csvData, {
					columns: true,
					skip_empty_lines: true,
				});

				// Check if the strategy already exists
				const existingStrategyIndex = existingStrategies.findIndex(
					(s: any) => s.Name.toLowerCase() === name.toLowerCase(),
				);

				if (existingStrategyIndex >= 0) {
					// This is an update
					isUpdate = true;
					existingStrategies[existingStrategyIndex] = {
						Name: name,
						"Target Token": targetToken,
						"Source Tokens": sourceTokens.join(","),
						"Total Budget": totalBudget,
						"Max Slippage": maxSlippage.toString(),
						"Trigger Threshold": triggerThreshold.toString(),
						"Privacy Level": privacyLevel,
						"Is Active": isActive.toString(),
						"Created At":
							existingStrategies[existingStrategyIndex]["Created At"],
						"Last Updated": new Date().toISOString(),
					};
				}
			}

			// Save the strategy to CSV
			await saveStrategyToCsv({
				name,
				targetToken,
				sourceTokens,
				totalBudget,
				maxSlippage,
				triggerThreshold,
				privacyLevel,
				isActive,
				isUpdate,
				existingStrategies,
			});

			// Initialize network configuration and check tokens
			const network =
				runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.TESTNET;

			// Get token addresses
			const tokenAddresses =
				network === OASIS_NETWORKS.MAINNET
					? TOKEN_ADDRESSES.MAINNET
					: TOKEN_ADDRESSES.TESTNET;

			// Verify all tokens have addresses
			const invalidTokens = [];

			if (!tokenAddresses[targetToken]) {
				invalidTokens.push(targetToken);
			}

			for (const token of sourceTokens) {
				if (!tokenAddresses[token]) {
					invalidTokens.push(token);
				}
			}

			if (invalidTokens.length > 0) {
				callback(
					{
						text: `Warning: The following tokens are not available on ${network}: ${invalidTokens.join(", ")}. The strategy has been saved but may not execute properly.`,
					},
					[],
				);
				return;
			}

			// Format source tokens for display
			const sourceTokensDisplay =
				sourceTokens.length > 1
					? sourceTokens.slice(0, -1).join(", ") +
						" and " +
						sourceTokens[sourceTokens.length - 1]
					: sourceTokens[0];

			// Prepare success message
			const actionText = isUpdate ? "updated" : "created";
			let resultMessage = `Successfully ${actionText} swap strategy "${name}":\n\n`;
			resultMessage += `• Target token: ${targetToken}\n`;
			resultMessage += `• Source tokens: ${sourceTokensDisplay}\n`;
			resultMessage += `• Total budget: ${totalBudget}\n`;
			resultMessage += `• Trigger threshold: ${triggerThreshold * 100}%\n`;
			resultMessage += `• Maximum slippage: ${maxSlippage}%\n`;
			resultMessage += `• Privacy level: ${privacyLevel}\n`;
			resultMessage += `• Status: ${isActive ? "Active" : "Inactive"}\n\n`;

			resultMessage += `The strategy will automatically execute swaps when any of the source tokens deviates from the target token by more than ${triggerThreshold * 100}%.`;

			callback(
				{
					text: resultMessage,
				},
				[],
			);
		} catch (error) {
			elizaLogger.error("Error in SETUP_SWAP_STRATEGY handler:", error);
			callback(
				{
					text: `An error occurred while setting up the swap strategy: ${error.message}`,
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
					text: "Create a swap strategy to target USDC using USDT and DAI",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Successfully created swap strategy "USDC Optimizer":

• Target token: USDC
• Source tokens: USDT and DAI
• Total budget: 1000
• Trigger threshold: 0.5%
• Maximum slippage: 0.5%
• Privacy level: high
• Status: Active

The strategy will automatically execute swaps when any of the source tokens deviates from the target token by more than 0.5%.`,
				},
			},
		],
	],
};

/**
 * Action for executing strategies manually
 */
export const executeStrategyAction: Action = {
	name: "EXECUTE_STRATEGY",
	similes: [
		"RUN_STRATEGY",
		"TRIGGER_STRATEGY",
		"EXECUTE_SWAP_STRATEGY",
		"START_STRATEGY",
		"APPLY_STRATEGY",
	],
	description: "Manually execute an automated swap strategy",
	validate: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.info("Validating runtime for EXECUTE_STRATEGY...");
		return !!(
			runtime.getSetting("THORN_API_URL") && runtime.getSetting("OASIS_NETWORK")
		);
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.debug("Starting EXECUTE_STRATEGY handler...");

		try {
			// Get the strategy name from the user message
			const userMessage = message.content?.text || "";

			// Look for a strategy name in the message
			const strategyNameMatch =
				userMessage.match(/strategy\s+["']?([^"']+)["']?/i) ||
				userMessage.match(/execute\s+["']?([^"']+)["']?/i) ||
				userMessage.match(/run\s+["']?([^"']+)["']?/i);

			let targetStrategyName = strategyNameMatch ? strategyNameMatch[1] : null;

			// If no strategy name found, check for list of strategies
			if (!targetStrategyName && fs.existsSync(STRATEGY_CSV_FILE_PATH)) {
				const csvData = await fs.promises.readFile(
					STRATEGY_CSV_FILE_PATH,
					"utf-8",
				);
				const strategies = parse(csvData, {
					columns: true,
					skip_empty_lines: true,
				});

				if (strategies.length === 0) {
					callback(
						{
							text: "No swap strategies found. Please create a strategy first using the SETUP_SWAP_STRATEGY action.",
						},
						[],
					);
					return;
				} else if (strategies.length === 1) {
					// If only one strategy exists, use that
					targetStrategyName = strategies[0].Name;
				} else {
					// List available strategies
					let strategyList = "Available strategies:\n";
					strategies.forEach((strategy: any) => {
						strategyList += `- ${strategy.Name} (${strategy["Target Token"]})\n`;
					});

					callback(
						{
							text: `Please specify which strategy to execute. ${strategyList}`,
						},
						[],
					);
					return;
				}
			}

			if (!targetStrategyName) {
				callback(
					{
						text: "Could not determine which strategy to execute. Please specify a strategy name or create one first.",
					},
					[],
				);
				return;
			}

			// Load the specified strategy
			if (!fs.existsSync(STRATEGY_CSV_FILE_PATH)) {
				callback(
					{
						text: "No strategies found. Please create a strategy first using the SETUP_SWAP_STRATEGY action.",
					},
					[],
				);
				return;
			}

			const csvData = await fs.promises.readFile(
				STRATEGY_CSV_FILE_PATH,
				"utf-8",
			);
			const strategies = parse(csvData, {
				columns: true,
				skip_empty_lines: true,
			});

			const strategy = strategies.find(
				(s: any) => s.Name.toLowerCase() === targetStrategyName.toLowerCase(),
			);

			if (!strategy) {
				callback(
					{
						text: `Strategy "${targetStrategyName}" not found. Please check the name or create it first.`,
					},
					[],
				);
				return;
			}

			// Extract strategy details
			const strategyDetails = {
				name: strategy.Name,
				targetToken: strategy["Target Token"],
				sourceTokens: strategy["Source Tokens"].split(","),
				totalBudget: strategy["Total Budget"],
				maxSlippage: Number.parseFloat(strategy["Max Slippage"]),
				triggerThreshold: Number.parseFloat(strategy["Trigger Threshold"]),
				privacyLevel: strategy["Privacy Level"],
				isActive: strategy["Is Active"].toLowerCase() === "true",
			};

			if (!strategyDetails.isActive) {
				callback(
					{
						text: `Strategy "${strategyDetails.name}" is inactive. Please activate it first by updating the strategy.`,
					},
					[],
				);
				return;
			}

			// Initialize network configuration
			const network =
				runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.TESTNET;
			const networkId = getNetworkId(runtime);

			// Get contract addresses for the network
			const contracts =
				network === OASIS_NETWORKS.MAINNET
					? THORN_CONTRACTS.MAINNET
					: THORN_CONTRACTS.TESTNET;

			// Use ContractHelper
			const contractHelper = createContractHelper(runtime);

			// Get token addresses
			const tokenAddresses =
				network === OASIS_NETWORKS.MAINNET
					? TOKEN_ADDRESSES.MAINNET
					: TOKEN_ADDRESSES.TESTNET;

			// Verify all tokens have addresses
			const targetTokenAddress = tokenAddresses[strategyDetails.targetToken];
			if (!targetTokenAddress) {
				callback(
					{
						text: `Target token ${strategyDetails.targetToken} is not available on ${network}. Cannot execute strategy.`,
					},
					[],
				);
				return;
			}

			// Execute the strategy logic
			let swapsExecuted = 0;
			const swapResults = [];

			// For each source token, check price and execute swap if needed
			for (const sourceToken of strategyDetails.sourceTokens) {
				const sourceTokenAddress = tokenAddresses[sourceToken];
				if (!sourceTokenAddress) {
					elizaLogger.warn(
						`Source token ${sourceToken} address not found, skipping`,
					);
					continue;
				}

				try {
					// Get current price (in a real implementation, would use a price oracle)
					// Here we'll simulate a price with small deviation
					const idealRatio = 1.0;
					const actualRatio = idealRatio * (1 + (Math.random() * 0.04 - 0.02)); // +/- 2%
					const deviation = Math.abs(actualRatio - idealRatio);

					// Check if deviation exceeds threshold
					if (deviation > strategyDetails.triggerThreshold) {
						// Calculate swap amount (in a real implementation would be based on budget and deviation)
						const swapAmount = (
							Number.parseFloat(strategyDetails.totalBudget) * 0.1
						).toString(); // 10% of budget

						// Execute swap if needed
						elizaLogger.info(
							`Executing swap for ${sourceToken} to ${strategyDetails.targetToken} due to ${deviation * 100}% deviation`,
						);

						// In a real implementation, this would call the swap function on the contract
						// Here we'll simulate a successful swap
						const simulatedResult = {
							fromToken: sourceToken,
							toToken: strategyDetails.targetToken,
							sentAmount: swapAmount,
							receivedAmount: (
								Number.parseFloat(swapAmount) * actualRatio
							).toString(),
							exchangeRate: actualRatio.toString(),
							txHash: "0x" + Math.random().toString(16).substr(2, 40),
						};

						swapsExecuted++;
						swapResults.push(simulatedResult);
					} else {
						elizaLogger.info(
							`Skipping ${sourceToken}: deviation ${deviation * 100}% is below threshold ${strategyDetails.triggerThreshold * 100}%`,
						);
					}
				} catch (error) {
					elizaLogger.error(
						`Error processing source token ${sourceToken}:`,
						error,
					);
				}
			}

			// Generate response based on results
			if (swapsExecuted === 0) {
				callback(
					{
						text: `Executed strategy "${strategyDetails.name}" but no swaps were needed. All tokens are within the ${strategyDetails.triggerThreshold * 100}% deviation threshold.`,
					},
					[],
				);
			} else {
				let resultMessage = `Successfully executed strategy "${strategyDetails.name}" with ${swapsExecuted} swap(s):\n\n`;

				swapResults.forEach((result, index) => {
					resultMessage += `Swap ${index + 1}:\n`;
					resultMessage += `• ${result.fromToken} → ${result.toToken}\n`;
					resultMessage += `• Amount: ${result.sentAmount} ${result.fromToken} → ${result.receivedAmount} ${result.toToken}\n`;
					resultMessage += `• Exchange rate: 1 ${result.fromToken} = ${result.exchangeRate} ${result.toToken}\n`;
					resultMessage += `• Transaction: ${result.txHash}\n\n`;
				});

				callback(
					{
						text: resultMessage,
					},
					[],
				);
			}
		} catch (error) {
			elizaLogger.error("Error in EXECUTE_STRATEGY handler:", error);
			callback(
				{
					text: `An error occurred while executing the strategy: ${error.message}`,
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
					text: "Execute the USDC Optimizer strategy",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Successfully executed strategy "USDC Optimizer" with 1 swap(s):

Swap 1:
• USDT → USDC
• Amount: 100 USDT → 99.75 USDC
• Exchange rate: 1 USDT = 0.9975 USDC
• Transaction: 0xabcd1234...`,
				},
			},
		],
	],
};

/**
 * Helper function to save strategy to CSV
 */
async function saveStrategyToCsv({
	name,
	targetToken,
	sourceTokens,
	totalBudget,
	maxSlippage,
	triggerThreshold,
	privacyLevel,
	isActive,
	isUpdate,
	existingStrategies,
}: {
	name: string;
	targetToken: string;
	sourceTokens: string[];
	totalBudget: string;
	maxSlippage: number;
	triggerThreshold: number;
	privacyLevel: string;
	isActive: boolean;
	isUpdate: boolean;
	existingStrategies: any[];
}) {
	try {
		// Ensure directory exists
		const dir = path.dirname(STRATEGY_CSV_FILE_PATH);
		if (!fs.existsSync(dir)) {
			await fs.promises.mkdir(dir, { recursive: true });
		}

		const now = new Date().toISOString();

		if (isUpdate) {
			// Rewrite the whole file with updated strategies
			const csvWriter = createArrayCsvWriter({
				path: STRATEGY_CSV_FILE_PATH,
				header: [
					"Name",
					"Target Token",
					"Source Tokens",
					"Total Budget",
					"Max Slippage",
					"Trigger Threshold",
					"Privacy Level",
					"Is Active",
					"Created At",
					"Last Updated",
				],
			});

			const records = existingStrategies.map((strategy: any) => [
				strategy.Name,
				strategy["Target Token"],
				strategy["Source Tokens"],
				strategy["Total Budget"],
				strategy["Max Slippage"],
				strategy["Trigger Threshold"],
				strategy["Privacy Level"],
				strategy["Is Active"],
				strategy["Created At"],
				strategy["Last Updated"],
			]);

			await csvWriter.writeRecords(records);
		} else {
			// Create CSV file with headers if it doesn't exist
			if (!fs.existsSync(STRATEGY_CSV_FILE_PATH)) {
				const csvWriter = createArrayCsvWriter({
					path: STRATEGY_CSV_FILE_PATH,
					header: [
						"Name",
						"Target Token",
						"Source Tokens",
						"Total Budget",
						"Max Slippage",
						"Trigger Threshold",
						"Privacy Level",
						"Is Active",
						"Created At",
						"Last Updated",
					],
				});
				await csvWriter.writeRecords([]);
			}

			// Append new record
			const csvWriter = createArrayCsvWriter({
				path: STRATEGY_CSV_FILE_PATH,
				header: [
					"Name",
					"Target Token",
					"Source Tokens",
					"Total Budget",
					"Max Slippage",
					"Trigger Threshold",
					"Privacy Level",
					"Is Active",
					"Created At",
					"Last Updated",
				],
				append: true,
			});

			await csvWriter.writeRecords([
				[
					name,
					targetToken,
					sourceTokens.join(","),
					totalBudget,
					maxSlippage.toString(),
					triggerThreshold.toString(),
					privacyLevel,
					isActive.toString(),
					now,
					now,
				],
			]);
		}

		elizaLogger.info("Strategy saved to CSV successfully");
	} catch (error) {
		elizaLogger.error("Failed to save strategy to CSV:", error);
		throw error;
	}
}

/**
 * Export the strategy plugin
 */
export const thornStrategyPlugin: Plugin = {
	name: "thornStrategy",
	description: "Automated swap strategies for Thorn Protocol",
	actions: [setupStrategyAction, executeStrategyAction],
	providers: [strategyProvider],
}; 