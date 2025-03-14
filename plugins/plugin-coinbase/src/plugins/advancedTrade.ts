import fs from "node:fs";
import { readFile } from "node:fs/promises";
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
import { RESTClient } from "../../advanced-sdk-ts/src/rest";
import {
	type OrderConfiguration,
	OrderSide,
} from "../../advanced-sdk-ts/src/rest/types/common-types";
import { advancedTradeTemplate } from "../templates";
import { AdvancedTradeSchema, isAdvancedTradeContent } from "../types";

const tradeCsvFilePath = path.join("/tmp", "advanced_trades.csv");

const _tradeProvider: Provider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.debug("Starting tradeProvider function");
		try {
			const client = new RESTClient(
				runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
				runtime.getSetting("COINBASE_PRIVATE_KEY") ??
					process.env.COINBASE_PRIVATE_KEY,
			);

			// Get accounts and products information
			// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
			let accounts;
			// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
			let products;
			try {
				accounts = await client.listAccounts({});
			} catch (error) {
				elizaLogger.error("Error fetching accounts:", error.message);
				return [];
			}

			try {
				products = await client.listProducts({});
			} catch (error) {
				elizaLogger.error("Error fetching products:", error.message);
				return [];
			}

			// Read CSV file logic remains the same
			if (!fs.existsSync(tradeCsvFilePath)) {
				const csvWriter = createArrayCsvWriter({
					path: tradeCsvFilePath,
					header: ["Order ID", "Success", "Order Configuration", "Response"],
				});
				await csvWriter.writeRecords([]);
			}

			// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
			let csvData;
			// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
			let records;
			try {
				csvData = await readFile(tradeCsvFilePath, "utf-8");
			} catch (error) {
				elizaLogger.error("Error reading CSV file:", error.message);
				return [];
			}

			try {
				records = parse(csvData, {
					columns: true,
					skip_empty_lines: true,
				});
			} catch (error) {
				elizaLogger.error("Error parsing CSV data:", error.message);
				return [];
			}

			return {
				accounts: accounts.accounts,
				products: products.products,
				trades: records,
			};
		} catch (error) {
			elizaLogger.error("Error in tradeProvider:", error.message);
			return [];
		}
	},
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export async function appendTradeToCsv(tradeResult: any) {
	elizaLogger.debug("Starting appendTradeToCsv function");
	try {
		const csvWriter = createArrayCsvWriter({
			path: tradeCsvFilePath,
			header: ["Order ID", "Success", "Order Configuration", "Response"],
			append: true,
		});
		elizaLogger.info("Trade result:", tradeResult);

		// Format trade data based on success/failure
		const formattedTrade = [
			tradeResult.success_response?.order_id ||
				tradeResult.failure_response?.order_id ||
				"",
			tradeResult.success,
			// JSON.stringify(tradeResult.order_configuration || {}),
			// JSON.stringify(tradeResult.success_response || tradeResult.failure_response || {})
		];

		elizaLogger.info("Formatted trade for CSV:", formattedTrade);
		await csvWriter.writeRecords([formattedTrade]);
		elizaLogger.info("Trade written to CSV successfully");
	} catch (error) {
		elizaLogger.error("Error writing trade to CSV:", error.message);
		// Log the actual error for debugging
		if (error instanceof Error) {
			elizaLogger.error("Error details:", error.message);
		}
	}
}

async function hasEnoughBalance(
	client: RESTClient,
	currency: string,
	amount: number,
	side: string,
): Promise<boolean> {
	elizaLogger.debug("Starting hasEnoughBalance function");
	try {
		const response = await client.listAccounts({});
		const accounts = JSON.parse(response);
		elizaLogger.info("Accounts:", accounts);
		const checkCurrency = side === "BUY" ? "USD" : currency;
		elizaLogger.info(
			`Checking balance for ${side} order of ${amount} ${checkCurrency}`,
		);

		// Find account with exact currency match
		const account = accounts?.accounts.find(
			(acc) =>
				acc.currency === checkCurrency &&
				(checkCurrency === "USD"
					? acc.type === "ACCOUNT_TYPE_FIAT"
					: acc.type === "ACCOUNT_TYPE_CRYPTO"),
		);

		if (!account) {
			elizaLogger.error(`No ${checkCurrency} account found`);
			return false;
		}

		const available = Number.parseFloat(account.available_balance.value);
		// Add buffer for fees only on USD purchases
		const requiredAmount = side === "BUY" ? amount * 1.01 : amount;
		elizaLogger.info(
			`Required amount (including buffer): ${requiredAmount} ${checkCurrency}`,
		);

		const hasBalance = available >= requiredAmount;
		elizaLogger.info(`Has sufficient balance: ${hasBalance}`);

		return hasBalance;
	} catch (error) {
		elizaLogger.error("Balance check failed with error:", {
			error: error instanceof Error ? error.message : "Unknown error",
			currency,
			amount,
			side,
		});
		return false;
	}
}

async function getPrice(client: RESTClient, productId: string) {
	elizaLogger.debug("Fetching product info for productId:", productId);
	try {
		const productInfo = await client.getProduct({ productId });
		const price = JSON.parse(productInfo)?.price;
		elizaLogger.info("Product info retrieved:", productInfo);
		elizaLogger.info("Price:", price);
		return Number(price);
	} catch (error) {
		elizaLogger.error("Error fetching product info:", error.message);
		return null;
	}
}

export const executeAdvancedTradeAction: Action = {
	name: "EXECUTE_ADVANCED_TRADE",
	description: "Execute a trade using Coinbase Advanced Trading API",
	validate: async (runtime: IAgentRuntime) => {
		return (
			!!(
				runtime.getSetting("COINBASE_API_KEY") || process.env.COINBASE_API_KEY
			) &&
			!!(
				runtime.getSetting("COINBASE_PRIVATE_KEY") ||
				process.env.COINBASE_PRIVATE_KEY
			)
		);
	},
	similes: [
		"EXECUTE_ADVANCED_TRADE",
		"ADVANCED_MARKET_ORDER",
		"ADVANCED_LIMIT_ORDER",
		"COINBASE_PRO_TRADE",
		"PROFESSIONAL_TRADE",
	],
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		let client: RESTClient;

		// Initialize client
		elizaLogger.debug("Starting advanced trade client initialization");
		try {
			client = new RESTClient(
				runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
				runtime.getSetting("COINBASE_PRIVATE_KEY") ??
					process.env.COINBASE_PRIVATE_KEY,
			);
			elizaLogger.info("Advanced trade client initialized");
		} catch (error) {
			elizaLogger.error("Client initialization failed:", error.message);
			callback(
				{
					text: "Failed to initialize trading client. Please check your API credentials.",
				},
				[],
			);
			return;
		}

		// Generate trade details
		// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
		let tradeDetails;
		elizaLogger.debug("Starting trade details generation");
		try {
			tradeDetails = await generateObject({
				runtime,
				context: composeContext({
					state,
					template: advancedTradeTemplate,
				}),
				modelClass: ModelClass.LARGE,
				schema: AdvancedTradeSchema,
			});
			elizaLogger.info("Trade details generated:", tradeDetails.object);
		} catch (error) {
			elizaLogger.error("Trade details generation failed:", error.message);
			callback(
				{
					text: "Failed to generate trade details. Please provide valid trading parameters.",
				},
				[],
			);
			return;
		}

		// Validate trade content
		if (!isAdvancedTradeContent(tradeDetails.object)) {
			elizaLogger.error("Invalid trade content:", tradeDetails.object);
			callback(
				{
					text: "Invalid trade details. Please check your input parameters.",
				},
				[],
			);
			return;
		}

		const { productId, amount, side, orderType, limitPrice } =
			tradeDetails.object;

		// Configure order
		let orderConfiguration: OrderConfiguration;
		elizaLogger.debug("Starting order configuration");
		let amountInCurrency = amount;
		try {
			if (orderType === "MARKET") {
				const priceInUSD = await getPrice(client, productId);
				elizaLogger.info("Price:", priceInUSD);
				if (side === "SELL") {
					amountInCurrency = Number.parseFloat(
						((1 / priceInUSD) * amountInCurrency).toFixed(7),
					);
				}
				elizaLogger.info("Amount in currency:", amountInCurrency);
				orderConfiguration =
					side === "BUY"
						? {
								market_market_ioc: {
									quote_size: amountInCurrency.toString(),
								},
							}
						: {
								market_market_ioc: {
									base_size: amountInCurrency.toString(),
								},
							};
			} else {
				if (!limitPrice) {
					throw new Error("Limit price is required for limit orders");
				}
				orderConfiguration = {
					limit_limit_gtc: {
						baseSize: amountInCurrency.toString(),
						limitPrice: limitPrice.toString(),
						postOnly: false,
					},
				};
			}
			elizaLogger.info("Order configuration created:", orderConfiguration);
		} catch (error) {
			elizaLogger.error("Order configuration failed:", error.message);
			callback(
				{
					text:
						error instanceof Error
							? error.message
							: "Failed to configure order parameters.",
				},
				[],
			);
			return;
		}

		// Execute trade
		try {
			elizaLogger.debug("Executing the trade");
			if (
				!(await hasEnoughBalance(
					client,
					productId.split("-")[0],
					amountInCurrency,
					side,
				))
			) {
				callback(
					{
						text: `Insufficient ${side === "BUY" ? "USD" : productId.split("-")[0]} balance to execute this trade`,
					},
					[],
				);
				return;
			}

			const order = await client.createOrder({
				clientOrderId: crypto.randomUUID(),
				productId,
				side: side === "BUY" ? OrderSide.BUY : OrderSide.SELL,
				orderConfiguration,
			});

			elizaLogger.info("Trade executed successfully:", order);
			const parsedOrder = JSON.parse(order);
			elizaLogger.info("Parsed order:", JSON.stringify(parsedOrder));
			elizaLogger.info("Parsed order success:", parsedOrder.success);
			if (parsedOrder.success === true) {
				const response: Content = {
					text: `Advanced Trade executed successfully:
- Product: ${productId}
- Type: ${orderType} Order
- Side: ${side}
- Amount: ${amountInCurrency}
${orderType === "LIMIT" ? `- Limit Price: ${limitPrice}\n` : ""}`,
				};

				callback(response, []);

				traceResult(state, response);
			} else {
				callback(
					{
						text: `Failed to execute trade: ${
							// biome-ignore lint/suspicious/noExplicitAny: <explanation>
							(parsedOrder as any)?.error_response?.message ??
							"Unknown error occurred"
						}`,
					},
					[],
				);
			}
		} catch (error) {
			elizaLogger.error("Trade execution failed:", error?.message);
			callback(
				{
					text: `Failed to execute trade: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
				},
				[],
			);
			return;
		}
		// Log trade to CSV
		try {
			// await appendTradeToCsv(order);
			elizaLogger.info("Trade logged to CSV");
		} catch (csvError) {
			elizaLogger.warn("Failed to log trade to CSV:", csvError.message);
			// Continue execution as this is non-critical
		}
	},
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Place an advanced market order to buy $1 worth of BTC",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Advanced Trade executed successfully:
- Product: BTC-USD
- Type: Market Order
- Side: BUY
- Amount: 1000
- Order ID: CB-ADV-12345
- Success: true
- Response: {"success_response":{}}
- Order Configuration: {"market_market_ioc":{"quote_size":"1000"}}`,
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: { text: "Set a limit order to sell 0.5 ETH at $2000" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Advanced Trade executed successfully:
- Product: ETH-USD
- Type: Limit Order
- Side: SELL
- Amount: 0.5
- Limit Price: 2000
- Order ID: CB-ADV-67890
- Success: true
- Response: {"success_response":{}}
- Order Configuration: {"limit_limit_gtc":{"baseSize":"0.5","limitPrice":"2000","postOnly":false}}`,
				},
			},
		],
	],
};

export const advancedTradePlugin: Plugin = {
	name: "advancedTradePlugin",
	description: "Enables advanced trading using Coinbase Advanced Trading API",
	actions: [executeAdvancedTradeAction],
	providers: [],
};
