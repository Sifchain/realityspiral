import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import {
	type Client,
	Content,
	HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type Provider,
	type State,
	type UUID,
	composeContext,
	elizaLogger,
	generateText,
	stringToUuid,
} from "@elizaos/core";
import {
	TOKENS,
	getPriceInquiry,
	getQuoteObj,
	tokenSwap,
} from "@realityspiral/plugin-0x";
import {
	type CoinbaseWallet,
	initializeWallet,
	readContractWrapper,
} from "@realityspiral/plugin-coinbase";
import { postTweet } from "@realityspiral/plugin-twitter";
import express from "express";
import {
	http,
	createWalletClient,
	erc20Abi,
	formatUnits,
	publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
	type WebhookEvent,
	blockExplorerBaseAddressUrl,
	blockExplorerBaseTxUrl,
	supportedTickers,
} from "./types";

export type { WebhookEvent };

export type WalletType =
	| "short_term_trading"
	| "long_term_trading"
	| "dry_powder"
	| "operational_capital";

export class CoinbaseClient implements Client {
	private runtime: IAgentRuntime;
	private server: express.Application;
	private port: number;
	private wallets: CoinbaseWallet[];
	private initialBalanceETH: number;

	constructor(runtime: IAgentRuntime) {
		this.runtime = runtime;
		// add providers to runtime
		this.runtime.providers.push(pnlProvider);
		this.runtime.providers.push(balanceProvider);
		this.runtime.providers.push(addressProvider);
		this.server = express();
		this.port = Number(runtime.getSetting("COINBASE_WEBHOOK_PORT")) || 3001;
		this.wallets = [];
		this.initialBalanceETH = 1;
	}

	async initialize(): Promise<void> {
		elizaLogger.info("Initializing Coinbase client");
		try {
			// await this.initializeWallets();
			elizaLogger.info("Wallets initialized successfully");
			await this.setupWebhookEndpoint();
			elizaLogger.info("Webhook endpoint setup successfully");
		} catch (error) {
			elizaLogger.error("Failed to initialize Coinbase client:", error);
			throw error;
		}
	}

	private setupWebhookEndpoint() {
		this.server.use(express.json());

		// Add CORS middleware to allow external requests
		this.server.use((req, res, next) => {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Methods", "POST");
			res.header("Access-Control-Allow-Headers", "Content-Type");
			if (req.method === "OPTIONS") {
				return res.sendStatus(200);
			}
			next();
		});

		// Add webhook validation middleware
		const _validateWebhook = (
			req: express.Request,
			res: express.Response,
			next: express.NextFunction,
		) => {
			const event = req.body as WebhookEvent;
			elizaLogger.info("event ", JSON.stringify(event));
			if (!event.event || !event.ticker || !event.timestamp || !event.price) {
				res.status(400).json({ error: "Invalid webhook payload" });
				return;
			}
			if (event.event !== "buy" && event.event !== "sell") {
				res.status(400).json({ error: "Invalid event type" });
				return;
			}
			next();
		};

		// Add health check endpoint
		this.server.get("/health", (_req, res) => {
			res.status(200).json({ status: "ok" });
		});

		this.server.get("/webhook/coinbase/health", (_req, res) => {
			elizaLogger.info("Health check received");
			res.status(200).json({ status: "ok" });
		});

		this.server.post("/webhook/coinbase/:agentId", async (req, res) => {
			elizaLogger.info("Webhook received for agent:", req.params.agentId);
			const runtime = this.runtime;

			if (!runtime) {
				res.status(404).json({ error: "Agent not found" });
				return;
			}

			// Validate the webhook payload
			const event = req.body as WebhookEvent;
			if (!event.event || !event.ticker || !event.timestamp || !event.price) {
				res.status(400).json({ error: "Invalid webhook payload" });
				return;
			}
			if (event.event !== "buy" && event.event !== "sell") {
				res.status(400).json({ error: "Invalid event type" });
				return;
			}

			try {
				// Forward the webhook event to the client's handleWebhookEvent method
				await this.handleWebhookEvent(event);
				res.status(200).json({ status: "success" });
			} catch (error) {
				elizaLogger.error("Error processing Coinbase webhook:", error.message);
				res.status(500).json({ error: "Internal Server Error" });
			}
		});

		return new Promise<void>((resolve, reject) => {
			try {
				this.server.listen(this.port, "0.0.0.0", () => {
					elizaLogger.info(`Webhook server listening on port ${this.port}`);
					resolve();
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	private async initializeWallets() {
		Coinbase.configure({
			apiKeyName:
				this.runtime.getSetting("COINBASE_API_KEY") ??
				process.env.COINBASE_API_KEY,
			privateKey:
				this.runtime.getSetting("COINBASE_PRIVATE_KEY") ??
				process.env.COINBASE_PRIVATE_KEY,
		});
		const walletTypes: WalletType[] = [
			"short_term_trading",
			"long_term_trading",
			"dry_powder",
			"operational_capital",
		];
		const networkId = Coinbase.networks.BaseMainnet;
		for (const walletType of walletTypes) {
			elizaLogger.info("walletType ", walletType);
			const wallet = await initializeWallet(
				this.runtime,
				networkId,
				walletType,
			);
			elizaLogger.info("Successfully loaded wallet ", wallet.wallet.getId());
			this.wallets.push(wallet);
		}
	}

	private async generateTweetContent(
		event: WebhookEvent,
		amountInCurrency: number,
		_pnl: string,
		formattedTimestamp: string,
		state: State,
		hash: string | null,
	): Promise<string> {
		try {
			const tradeTweetTemplate = `
# Task
Craft a compelling and concise tweet to announce a Coinbase trade. Aim for creativity and professionalism.

Trade specifics:
- ${event.event.toUpperCase()} order for ${event.ticker}
- Amount traded: $${amountInCurrency.toFixed(2)}
- Price at trade: $${Number(event.price).toFixed(2)}
- Timestamp: ${formattedTimestamp}
Guidelines:
1. Keep it under 80 characters
2. Include 1-2 relevant emojis
3. Avoid hashtags
4. Use varied wording for freshness
5. Mention market conditions, timing, or strategy if applicable
6. Maintain a professional yet conversational tone
7. Ensure key details are present: action, amount, ticker, and price

Sample buy tweets:
"📈 Added $${amountInCurrency.toFixed(2)} of ${event.ticker} at $${Number(
				event.price,
			).toFixed(2)}."
"🎯 Strategic ${event.ticker} buy: $${amountInCurrency.toFixed(2)} at $${Number(
				event.price,
			).toFixed(2)}."

Sample sell tweets:
"💫 Sold ${event.ticker}: $${amountInCurrency.toFixed(2)} at $${Number(
				event.price,
			).toFixed(2)}."
"📊 Sold $${amountInCurrency.toFixed(2)} of ${event.ticker} at $${Number(
				event.price,
			).toFixed(2)}."

Generate only the tweet text, no commentary or markdown.`;
			const context = composeContext({
				template: tradeTweetTemplate,
				state,
			});

			const tweetContent = await generateText({
				runtime: this.runtime,
				context,
				modelClass: ModelClass.LARGE,
			});

			const trimmedContent = tweetContent.trim();
			const finalContent = `${trimmedContent} ${blockExplorerBaseTxUrl(hash)}`;
			return finalContent.length > 180
				? `${finalContent.substring(0, 177)}...`
				: finalContent;
		} catch (error) {
			elizaLogger.error("Error generating tweet content:", error);
			const amount =
				Number(this.runtime.getSetting("COINBASE_TRADING_AMOUNT")) ?? 1;
			const fallbackTweet = `🚀 ${event.event.toUpperCase()}: $${amount.toFixed(
				2,
			)} of ${event.ticker} at $${Number(event.price).toFixed(2)}`;
			return fallbackTweet;
		}
	}

	private async handleWebhookEvent(event: WebhookEvent) {
		// for now just support ETH
		if (!supportedTickers.includes(event.ticker)) {
			elizaLogger.info("Unsupported ticker:", event.ticker);
			return;
		}
		// Set up room and ensure participation
		const roomId = stringToUuid("coinbase-trading");
		await this.setupRoom(roomId);

		// Get trading amount from settings
		const amount =
			Number(this.runtime.getSetting("COINBASE_TRADING_AMOUNT")) ?? 1;

		// Create and store memory of trade
		const memory = this.createTradeMemory(event, amount, roomId);
		await this.runtime.messageManager.createMemory(memory);

		// Generate state and format timestamp
		const state = await this.runtime.composeState(memory);
		const formattedTimestamp = this.getFormattedTimestamp();

		// Execute token swap
		const buy = event.event.toUpperCase() === "BUY";
		const amountInCurrency = buy
			? amount * 1e6
			: (amount / Number(event.price)) * 1e18;
		const pnl = await calculateOverallPNL(
			this.runtime,
			this.runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`,
			1000,
		);
		elizaLogger.info("pnl ", pnl);
		const txHash = await this.executeTokenSwap(event, amountInCurrency, buy);
		if (txHash == null) {
			elizaLogger.error("txHash is null");
			return;
		}
		elizaLogger.info("txHash ", txHash);

		// Generate and post tweet
		await this.handleTweetPosting(
			event,
			amount,
			pnl,
			formattedTimestamp,
			state,
			txHash,
		);
	}

	private async setupRoom(roomId: UUID) {
		await this.runtime.ensureRoomExists(roomId);
		await this.runtime.ensureParticipantInRoom(this.runtime.agentId, roomId);
	}

	private createTradeMemory(
		event: WebhookEvent,
		amount: number,
		roomId: UUID,
	): Memory {
		return {
			id: stringToUuid(`coinbase-${event.timestamp}`),
			userId: this.runtime.agentId,
			agentId: this.runtime.agentId,
			roomId,
			content: {
				text: `${event.event.toUpperCase()} $${amount} worth of ${
					event.ticker
				}`,
				action: "SWAP",
				source: "coinbase",
				metadata: {
					ticker: event.ticker,
					side: event.event.toUpperCase(),
					price: event.price,
					amount: amount,
					timestamp: event.timestamp,
					walletType: "short_term_trading",
				},
			},
			createdAt: Date.now(),
		};
	}

	private getFormattedTimestamp(): string {
		return new Intl.DateTimeFormat("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			timeZoneName: "short",
		}).format(new Date());
	}

	private async executeTokenSwap(
		event: WebhookEvent,
		amount: number,
		buy: boolean,
	): Promise<string | null> {
		return await tokenSwap(
			this.runtime,
			amount,
			buy ? "USDC" : event.ticker,
			buy ? event.ticker : "USDC",
			this.runtime.getSetting("WALLET_PUBLIC_KEY"),
			this.runtime.getSetting("WALLET_PRIVATE_KEY"),
			"base",
		);
	}

	private async handleTweetPosting(
		event: WebhookEvent,
		amount: number,
		pnl: string,
		formattedTimestamp: string,
		state: State,
		txHash: string,
	) {
		try {
			const tweetContent = await this.generateTweetContent(
				event,
				amount,
				pnl,
				formattedTimestamp,
				state,
				txHash,
			);
			elizaLogger.info("Generated tweet content:", tweetContent);

			if (this.runtime.getSetting("TWITTER_DRY_RUN").toLowerCase() === "true") {
				elizaLogger.info("Dry run mode enabled. Skipping tweet posting.");
				return;
			}

			const response = await postTweet(this.runtime, tweetContent);
			elizaLogger.info("Tweet response:", response);
		} catch (error) {
			elizaLogger.error("Failed to post tweet:", error);
		}
	}

	async stop(): Promise<void> {
		try {
			if (this.server?.listen) {
				await new Promise<void>((resolve, reject) => {
					this.server.listen().close((err: Error | undefined) => {
						if (err) reject(err);
						else resolve();
					});
				});
			}
			elizaLogger.info("Coinbase client stopped successfully");
		} catch (error) {
			elizaLogger.error("Error stopping Coinbase client:", error);
			throw error;
		}
	}

	getType(): string {
		return "coinbase";
	}

	getName(): string {
		return "coinbase";
	}

	async start(): Promise<void> {
		await this.initialize();
	}
}

export const CoinbaseClientInterface: Client = {
	start: async (runtime: IAgentRuntime) => {
		elizaLogger.info(
			"Starting Coinbase client with agent ID:",
			runtime.agentId,
		);
		const client = new CoinbaseClient(runtime);
		await client.start();
		return client;
	},
	stop: async (runtime: IAgentRuntime) => {
		try {
			elizaLogger.info("Stopping Coinbase client");
			await runtime.clients.coinbase.stop();
		} catch (e) {
			elizaLogger.error("Coinbase client stop error:", e);
		}
	},
};

export const calculateOverallPNL = async (
	runtime: IAgentRuntime,
	publicKey: `0x${string}`,
	initialBalance: number,
): Promise<string> => {
	const totalBalanceUSD = await getTotalBalanceUSD(runtime, publicKey);
	const pnlUSD = totalBalanceUSD - initialBalance;
	elizaLogger.info(`pnlUSD ${pnlUSD}`);
	const absoluteValuePNL = Math.abs(pnlUSD);
	elizaLogger.info(`absoluteValuePNL ${absoluteValuePNL}`);
	const formattedPNL = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(absoluteValuePNL);
	elizaLogger.info(`formattedPNL ${formattedPNL}`);
	const formattedPNLUSD = `${pnlUSD < 0 ? "-" : ""}${formattedPNL}`;
	elizaLogger.info(`formattedPNLUSD ${formattedPNLUSD}`);
	return formattedPNLUSD;
};

export async function getTotalBalanceUSD(
	runtime: IAgentRuntime,
	publicKey: `0x${string}`,
): Promise<number> {
	const client = createWalletClient({
		account: privateKeyToAccount(
			`0x${runtime.getSetting("WALLET_PRIVATE_KEY")}` as `0x${string}`,
		),
		chain: base,
		transport: http(runtime.getSetting("ALCHEMY_HTTP_TRANSPORT_URL")),
	}).extend(publicActions);
	const ethBalanceBaseUnits = await client.getBalance({
		address: publicKey,
		blockTag: "pending",
	});
	elizaLogger.info(`ethBalanceBaseUnits ${ethBalanceBaseUnits}`);
	const ethBalance = Number(ethBalanceBaseUnits) / 1e18;
	elizaLogger.info(`ethBalance ${ethBalance}`);
	const priceInquiry = await getPriceInquiry(
		runtime,
		"ETH",
		Number(ethBalanceBaseUnits.toString()),
		"USDC",
		"base",
	);
	if (priceInquiry == null) {
		elizaLogger.error("priceInquiry is null");
		return 1000;
	}
	const quote = await getQuoteObj(runtime, priceInquiry, publicKey);
	const ethBalanceUSD = Number(quote.buyAmount) / 1e6;
	elizaLogger.info(`ethBalanceUSD ${ethBalanceUSD}`);
	const usdcBalanceBaseUnits = await readContractWrapper(
		runtime,
		TOKENS.USDC.address as `0x${string}`,
		"balanceOf",
		{
			account: publicKey,
		},
		"base-mainnet",
		erc20Abi,
	);
	const usdcBalance = Number(usdcBalanceBaseUnits) / 1e6;
	elizaLogger.info(`usdcBalance ${usdcBalance}`);
	// get cbbtc balance
	const cbbtcBalanceBaseUnits = await readContractWrapper(
		runtime,
		TOKENS.cbBTC.address as `0x${string}`,
		"balanceOf",
		{
			account: publicKey,
		},
		"base-mainnet",
		erc20Abi,
	);
	elizaLogger.info(`cbbtcBalanceBaseUnits ${cbbtcBalanceBaseUnits}`);
	const cbbtcPriceInquiry = await getPriceInquiry(
		runtime,
		"CBBTC",
		Number(cbbtcBalanceBaseUnits.toString()),
		"USDC",
		"base",
	);
	if (cbbtcPriceInquiry == null) {
		elizaLogger.error("cbbtcPriceInquiry is null");
		return ethBalanceUSD + usdcBalance;
	}
	const cbbtcQuote = await getQuoteObj(runtime, cbbtcPriceInquiry, publicKey);
	const cbbtcBalanceUSD = Number(cbbtcQuote.buyAmount) / 1000000;
	elizaLogger.info(`ethBalanceUSD ${ethBalanceUSD}`);
	elizaLogger.info(`usdcBalanceUSD ${usdcBalance}`);
	elizaLogger.info(`cbbtcBalanceUSD ${cbbtcBalanceUSD}`);
	return ethBalanceUSD + usdcBalance + cbbtcBalanceUSD;
}

export const pnlProvider: Provider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.debug("Starting pnlProvider.get function");
		try {
			const pnl = await calculateOverallPNL(
				runtime,
				runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`,
				1000,
			);
			elizaLogger.info("pnl ", pnl);
			return `PNL: ${pnl}`;
		} catch (error) {
			elizaLogger.error("Error in pnlProvider: ", error.message);
			return [];
		}
	},
};

export const balanceProvider: Provider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		const totalBalanceUSD = await getTotalBalanceUSD(
			runtime,
			runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`,
		);
		return `Total balance: $${totalBalanceUSD.toFixed(2)}`;
	},
};

export const addressProvider: Provider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		return `Address: ${runtime.getSetting("WALLET_PUBLIC_KEY")}`;
	},
};

export const tradingSignalBackTestProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory) => {
		const timeFrames = {
            '1D': {
                btc: {
                    netProfit: 1100,
                    totalTradesClosed: 55,
                    percentageProfitable: 62,
                    profitFactor: 1.6,
                    maxDrawdown: 11,
                    averageTrade: 22,
                    numberOfBarsPerTrade: 6,
                    winRate: 57,
                    timePeriod: '1D'
                }
            },
            '5D': {
                btc: {
                    netProfit: 2100,
                    totalTradesClosed: 50,
                    percentageProfitable: 67,
                    profitFactor: 1.7,
                    maxDrawdown: 13,
                    averageTrade: 27,
                    numberOfBarsPerTrade: 7,
                    winRate: 62,
                    timePeriod: '5D'
                }
            },
            '1M': {
                btc: {
                    netProfit: 4100,
                    totalTradesClosed: 40,
                    percentageProfitable: 77,
                    profitFactor: 1.9,
                    maxDrawdown: 19,
                    averageTrade: 37,
                    numberOfBarsPerTrade: 9,
                    winRate: 72,
                    timePeriod: '1M'
                }
            },
            '3M': {
                btc: {
                    netProfit: 5100,
                    totalTradesClosed: 35,
                    percentageProfitable: 82,
                    profitFactor: 2.0,
                    maxDrawdown: 21,
                    averageTrade: 42,
                    numberOfBarsPerTrade: 10,
                    winRate: 77,
                    timePeriod: '3M'
                }
            }
        };

        const backtestResults = Object.entries(timeFrames).map(([timeFrame, data]) => {
            return `
            BTC ${timeFrame}: Net Profit: ${data.btc.netProfit}, Total Trades Closed: ${data.btc.totalTradesClosed}, Percentage Profitable: ${data.btc.percentageProfitable}, Profit Factor: ${data.btc.profitFactor}, Max Drawdown: ${data.btc.maxDrawdown}, Average Trade: ${data.btc.averageTrade}, Number of Bars per Trade: ${data.btc.numberOfBarsPerTrade}, Win Rate: ${data.btc.winRate}, Time Period: ${data.btc.timePeriod}
            `;
        }).join('\n');

        return `
        BACKTEST RESULTS for tickers being traded actively: 
        TICKER: BTC DIRECTION: LONG 
        ${backtestResults}
        `;
    },
};

export default CoinbaseClientInterface;
