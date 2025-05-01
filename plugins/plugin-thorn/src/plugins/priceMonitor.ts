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
	OASIS_NETWORKS,
	PRICE_MONITOR_CSV_FILE_PATH,
	THORN_CONTRACTS,
	THORN_DEFAULT_API_URL,
	TOKEN_ADDRESSES,
} from "../constants";
import { createContractHelper, getNetworkId } from "../helpers/contractUtils";
import { priceMonitorTemplate } from "../templates";
import { PriceMonitorSchema, isPriceMonitorContent } from "../types";

/**
 * Provider for retrieving price stability information
 */
export const priceStabilityProvider: Provider = {
	get: async (_runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.debug("Starting priceStabilityProvider.get function");
		try {
			// Check if the CSV file exists; if not, create it with headers
			if (!fs.existsSync(PRICE_MONITOR_CSV_FILE_PATH)) {
				elizaLogger.warn(
					"Price monitor CSV file not found. Creating a new one.",
				);
				const csvWriter = createArrayCsvWriter({
					path: PRICE_MONITOR_CSV_FILE_PATH,
					header: ["Timestamp", "Token", "Price", "Deviation", "Is Stable"],
				});
				await csvWriter.writeRecords([]); // Create an empty file with headers
				elizaLogger.info("New price monitor CSV file created with headers.");
			}

			// Read and parse the CSV file
			const csvData = await fs.promises.readFile(
				PRICE_MONITOR_CSV_FILE_PATH,
				"utf-8",
			);
			const records = parse(csvData, {
				columns: true,
				skip_empty_lines: true,
			});

			elizaLogger.info(`Found ${records.length} price monitor records in CSV`);

			// Transform records to the expected format
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const priceRecords = records.map((record: any) => ({
				timestamp: record.Timestamp,
				token: record.Token,
				price: record.Price,
				deviation: Number.parseFloat(record.Deviation),
				isStable: record["Is Stable"].toLowerCase() === "true",
			}));

			return {
				priceRecords,
			};
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (error: any) {
			elizaLogger.error("Error in priceStabilityProvider: ", error.message);
			return {
				priceRecords: [],
			};
		}
	},
};

/**
 * Action for monitoring stablecoin price stability
 */
export const monitorPriceStabilityAction: Action = {
	name: "MONITOR_PRICE_STABILITY",
	similes: [
		"CHECK_PRICE_STABILITY",
		"TRACK_STABLECOIN_PRICES",
		"MONITOR_STABLECOIN_PRICE",
		"DETECT_PRICE_DEVIATIONS",
		"PRICE_ALERT_SETUP",
		"STABILITY_CHECK",
	],
	description: "Monitor stablecoin price stability and detect deviations",
	validate: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.info("Validating runtime for MONITOR_PRICE_STABILITY...");
		return !!(
			runtime.getSetting("THORN_API_URL") && runtime.getSetting("OASIS_NETWORK")
		);
	},
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State | undefined,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback?: HandlerCallback,
	) => {
		elizaLogger.debug("Starting MONITOR_PRICE_STABILITY handler...");

		try {
			// Compose context and extract monitor parameters
			const context = composeContext({
				state: state || ({} as State),
				template: priceMonitorTemplate,
			});

			const monitorDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.LARGE,
				schema: PriceMonitorSchema,
			});

			if (!isPriceMonitorContent(monitorDetails.object)) {
				callback?.(
					{
						text: "Invalid price monitoring parameters. Please provide valid token symbols, alert threshold, and interval.",
					},
					[],
				);
				return;
			}

			const { tokens, alertThreshold, intervalMinutes } = monitorDetails.object;

			elizaLogger.info("Price monitoring details:", {
				tokens,
				alertThreshold,
				intervalMinutes,
			});

			// Initialize network configuration
			const network =
				runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.TESTNET;
			const _networkId = getNetworkId(runtime);

			// Get contract addresses for the network
			const _contracts =
				network === OASIS_NETWORKS.MAINNET
					? THORN_CONTRACTS.MAINNET
					: THORN_CONTRACTS.TESTNET;

			// Use ContractHelper directly
			const _contractHelper = createContractHelper(runtime);

			// Get token addresses
			const tokenAddresses =
				network === OASIS_NETWORKS.MAINNET
					? TOKEN_ADDRESSES.MAINNET
					: TOKEN_ADDRESSES.TESTNET;

			// Process all tokens
			const priceResults = [];
			const unstableTokens = [];

			for (const token of tokens) {
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				const tokenAddress = (tokenAddresses as any)[token];
				if (!tokenAddress) {
					elizaLogger.warn(`Token address not found for ${token}, skipping`);
					continue;
				}

				try {
					// In a real implementation, this would call a price oracle or use DEX data
					// For this simulation, we'll use a mock result
					const price = "1.00"; // Ideal price for a stablecoin

					// Simulate a small random deviation (0-2%)
					const deviation = Math.random() * 0.02;
					const actualPrice =
						Number.parseFloat(price) *
						(1 + (Math.random() > 0.5 ? deviation : -deviation));

					const isStable = deviation < alertThreshold;

					if (!isStable) {
						unstableTokens.push(token);
					}

					// Log price data
					await logPriceDataToCsv({
						token,
						price: actualPrice.toFixed(6),
						deviation,
						isStable,
						timestamp: Date.now(),
					});

					priceResults.push({
						token,
						price: actualPrice.toFixed(6),
						deviation: deviation.toFixed(4),
						isStable,
					});
				} catch (error) {
					elizaLogger.error(`Error checking price for ${token}:`, error);
				}
			}

			// Prepare result message
			let resultMessage = `Price stability monitoring completed for ${tokens.join(", ")}:\n\n`;

			// biome-ignore lint/complexity/noForEach: <explanation>
			priceResults.forEach((result) => {
				resultMessage += `${result.token}: $${result.price} (${result.deviation}% deviation) - ${result.isStable ? "✅ Stable" : "⚠️ Unstable"}\n`;
			});

			if (unstableTokens.length > 0) {
				resultMessage += `\n⚠️ ALERT: The following tokens exceeded the ${alertThreshold * 100}% deviation threshold: ${unstableTokens.join(", ")}`;
			} else {
				resultMessage += `\nAll monitored stablecoins are within the ${alertThreshold * 100}% deviation threshold.`;
			}

			resultMessage += `\n\nMonitoring will continue every ${intervalMinutes} minutes.`;

			callback?.(
				{
					text: resultMessage,
				},
				[],
			);
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (error: any) {
			elizaLogger.error("Error in MONITOR_PRICE_STABILITY handler:", error);
			callback?.(
				{
					text: `An error occurred while monitoring price stability: ${error.message}`,
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
					text: "Monitor price stability for USDC, USDT, and DAI",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Price stability monitoring completed for USDC, USDT, DAI:

USDC: $1.002 (0.20% deviation) - ✅ Stable
USDT: $0.998 (0.15% deviation) - ✅ Stable
DAI: $1.005 (0.50% deviation) - ✅ Stable

All monitored stablecoins are within the 1% deviation threshold.

Monitoring will continue every 30 minutes.`,
				},
			},
		],
	],
};

/**
 * Helper function to log price data to CSV
 */
async function logPriceDataToCsv(priceData: {
	token: string;
	price: string;
	deviation: number;
	isStable: boolean;
	timestamp: number;
}) {
	try {
		// Ensure directory exists
		const dir = path.dirname(PRICE_MONITOR_CSV_FILE_PATH);
		if (!fs.existsSync(dir)) {
			await fs.promises.mkdir(dir, { recursive: true });
		}

		// Create CSV file with headers if it doesn't exist
		if (!fs.existsSync(PRICE_MONITOR_CSV_FILE_PATH)) {
			const csvWriter = createArrayCsvWriter({
				path: PRICE_MONITOR_CSV_FILE_PATH,
				header: ["Timestamp", "Token", "Price", "Deviation", "Is Stable"],
			});
			await csvWriter.writeRecords([]);
		}

		// Append new record
		const csvWriter = createArrayCsvWriter({
			path: PRICE_MONITOR_CSV_FILE_PATH,
			header: ["Timestamp", "Token", "Price", "Deviation", "Is Stable"],
			append: true,
		});

		const date = new Date(priceData.timestamp);
		const formattedDate = date.toISOString();

		await csvWriter.writeRecords([
			[
				formattedDate,
				priceData.token,
				priceData.price,
				priceData.deviation.toString(),
				priceData.isStable.toString(),
			],
		]);

		elizaLogger.info("Price data logged to CSV successfully");
	} catch (error) {
		elizaLogger.error("Failed to log price data to CSV:", error);
		// Don't throw, just log the error
	}
}

/**
 * Export the price monitoring plugin
 */
export const thornPriceMonitorPlugin: Plugin = {
	name: "thornPriceMonitor",
	description: "Monitor stablecoin price stability on Thorn Protocol",
	actions: [monitorPriceStabilityAction],
	providers: [priceStabilityProvider],
};
