import { Coinbase } from "@coinbase/coinbase-sdk";
import {
	type Client,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type Provider,
	type State,
	type UUID,
	elizaLogger,
	generateText,
	stringToUuid,
} from "@elizaos/core";
import {
	TOKENS,
	getPriceInquiry,
	getQuoteObj,
	getTokenMetadata,
	tokenSwap,
} from "@realityspiral/plugin-0x";
import {
	type CoinbaseWallet,
	initializeWallet,
	readContractWrapper,
} from "@realityspiral/plugin-coinbase";
import { composeContext } from "@realityspiral/plugin-instrumentation";
import {
	Side,
	getProviderAndSigner,
	placeMarketOrder,
} from "@realityspiral/plugin-synfutures";
import { postTweet } from "@realityspiral/plugin-twitter";
import express from "express";
import { http, createWalletClient, erc20Abi, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
	type WebhookEvent,
	blockExplorerBaseAddressUrl,
	blockExplorerBaseTxUrl,
	supportedTickers,
} from "./types";
import { calculateAPR, fetchTokenPrice } from "./utils";

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
	private initialBuyAmountInCurrency: number | null;
	private winningStreak: number;

	constructor(runtime: IAgentRuntime) {
		this.runtime = runtime;
		// add providers to runtime
		this.runtime.providers.push(pnlProvider);
		this.runtime.providers.push(balanceProvider);
		this.runtime.providers.push(addressProvider);
		this.runtime.providers.push(tradingSignalBackTestProvider);
		this.runtime.providers.push(baseTokenAddressProvider);
		this.runtime.providers.push(solTokenAddressProvider);
		this.runtime.providers.push(stakingLiquidityPoolingProvider);
		this.runtime.providers.push(whatIsNextProvider);
		this.runtime.providers.push(currentPriceProvider);
		this.server = express();
		this.port = Number(runtime.getSetting("COINBASE_WEBHOOK_PORT")) || 3001;
		this.wallets = [];
		this.initialBuyAmountInCurrency = null;
		this.winningStreak = 0;
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
			elizaLogger.info(`event ${JSON.stringify(event)}`);
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
			elizaLogger.info(`walletType ${walletType}`);
			const wallet = await initializeWallet(
				this.runtime,
				networkId,
				walletType,
			);
			elizaLogger.info(`Successfully loaded wallet ${wallet.wallet.getId()}`);
			this.wallets.push(wallet);
		}
	}

	private async generateMediaContent(
		event: WebhookEvent,
		amountInCurrency: number,
		pnl: string,
		sellTradePNL: string,
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
			const isSellTrade = event.event.toUpperCase() === "SELL";
			const trimmedContent = tweetContent.trim();
			const finalContent = `${trimmedContent} ${isSellTrade ? `Trade PNL: ${sellTradePNL}` : ""} Overall PNL: ${pnl} Winning Streak: ${this.winningStreak} ${blockExplorerBaseTxUrl(hash)}`;
			return finalContent.length > 280
				? `${finalContent.substring(0, 277)}...`
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
		const price = event.price;
		// if sell, use the initial buy amount in currency instead of the current price
		let amountInCurrency: number;
		const tokenMetadata = getTokenMetadata(event.ticker);
		const usdcMetadata = getTokenMetadata("USDC");
		const tokenDecimals = tokenMetadata?.decimals || 18; // Default to 18 if not found
		const usdcDecimals = usdcMetadata?.decimals || 6; // Default to 6 if not found
		const amountSellInCurrencyInBaseUnits = Math.floor(
			(amount / Number(event.price)) * 10 ** tokenDecimals,
		);

		amountInCurrency = Math.floor(
			buy
				? amount * 10 ** usdcDecimals // Convert USD amount to USDC base units
				: amountSellInCurrencyInBaseUnits, // Convert to token base units
		);
		if (buy) {
			this.initialBuyAmountInCurrency = amountSellInCurrencyInBaseUnits;
		}
		if (!buy && this.initialBuyAmountInCurrency !== null) {
			amountInCurrency = this.initialBuyAmountInCurrency;
		}
		elizaLogger.info(`buy ${buy}`);
		elizaLogger.info(
			`this.initialBuyAmountInCurrency ${this.initialBuyAmountInCurrency}`,
		);

		const pnl = await calculateOverallPNL(
			this.runtime,
			this.runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`,
			1000,
		);
		const sellTradePNL = await calculateSellTradePNL(
			this.initialBuyAmountInCurrency !== null
				? this.initialBuyAmountInCurrency
				: amountSellInCurrencyInBaseUnits,
			amountSellInCurrencyInBaseUnits,
			Number(price),
			tokenDecimals,
		);
		const rawSellTradePNL = await calculateSellTradePNLRaw(
			this.initialBuyAmountInCurrency !== null
				? this.initialBuyAmountInCurrency
				: amountSellInCurrencyInBaseUnits,
			amountSellInCurrencyInBaseUnits,
			Number(price),
			tokenDecimals,
		);

		if (rawSellTradePNL > 0) {
			this.winningStreak++;
		} else {
			this.winningStreak = 0;
		}
		elizaLogger.info(`winningStreak ${this.winningStreak}`);
		const enoughBalance = await hasEnoughBalance(
			this.runtime,
			this.runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`,
			buy ? "USDC" : event.ticker,
			amountInCurrency,
		);
		elizaLogger.info(`enoughBalance ${enoughBalance}`);
		if (!enoughBalance) {
			elizaLogger.error("Not enough balance to trade");
			return;
		}
		const txHash = await this.executeTokenSwap(event, amountInCurrency, buy);
		if (txHash == null) {
			elizaLogger.error("txHash is null");
			return;
		}
		elizaLogger.info(`txHash ${txHash}`);
		let amountInUSD: number;
		if (buy) {
			amountInUSD = amount;
		} else {
			amountInUSD = (amountInCurrency / 10 ** tokenDecimals) * price;
		}
		elizaLogger.info(`amountInUSD ${amountInUSD}`);
		// Generate and post tweet
		await this.handleMediaPosting(
			event,
			amountInUSD,
			pnl,
			sellTradePNL,
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
		if (
			process.env.MARGIN_SHORT_TRADING_ENABLED &&
			process.env.MARGIN_SHORT_TRADING_ENABLED.toLowerCase() === "true"
		) {
			const defaultLeverage = Number(process.env.DEFAULT_LEVERAGE) || 5;
			// Map BUY to LONG and SELL to SHORT for margin trading
			const side = event.side === "long" ? Side.LONG : Side.SHORT;

			const instrumentSymbol = event.ticker;
			const { signer } = getProviderAndSigner();
			// need to consider closing the order
			try {
				const txHash = await placeMarketOrder(
					instrumentSymbol,
					// biome-ignore lint/suspicious/noExplicitAny: <explanation>
					side as any,
					String(amount),
					String(defaultLeverage),
					signer,
				);
				return txHash.transactionHash;
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			} catch (error: any) {
				elizaLogger.error("Margin/short trade failed:", error.message);
				return null;
			}
		} else {
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
	}

	private async handleMediaPosting(
		event: WebhookEvent,
		amountInUSD: number,
		pnl: string,
		sellTradePNL: string,
		formattedTimestamp: string,
		state: State,
		txHash: string,
	) {
		let mediaContent = "";
		try {
			mediaContent = await this.generateMediaContent(
				event,
				amountInUSD,
				pnl,
				sellTradePNL,
				formattedTimestamp,
				state,
				txHash,
			);
			elizaLogger.info(`Generated media content: ${mediaContent}`);

			if (this.runtime.getSetting("TWITTER_DRY_RUN").toLowerCase() === "true") {
				elizaLogger.info("Dry run mode enabled. Skipping tweet posting.");
			} else {
				// post tweet to twitter
				const response = await postTweet(this.runtime, mediaContent);
				elizaLogger.info(`Tweet response: ${response}`);
			}
		} catch (error) {
			elizaLogger.error("Failed to post tweet:", error);
		}
		try {
			if (
				this.runtime.getSetting("TELEGRAM_CLIENT_DISABLED").toLowerCase() ===
					"true" &&
				this.runtime.getSetting("TELEGRAM_BOT_TOKEN") !== null
			) {
				elizaLogger.info(
					"Telegram client disabled. Skipping telegram posting.",
				);
			} else {
				// post message to telegram
				if (mediaContent.length > 0) {
					await this.runtime.clients.telegram.messageManager.bot.telegram.sendMessage(
						this.runtime.getSetting("TELEGRAM_CHANNEL_ID"),
						mediaContent,
					);
				}
			}
		} catch (error) {
			elizaLogger.error("Failed to post telegram:", error);
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

export const calculateSellTradePNL = async (
	initialBuyAmountInCurrency: number,
	amountSellInCurrencyInBaseUnits: number,
	price: number,
	tokenDecimals: number,
): Promise<string> => {
	elizaLogger.info("calculateSellTradePNL");
	elizaLogger.info(`initialBuyAmountInCurrency ${initialBuyAmountInCurrency}`);
	elizaLogger.info(
		`amountSellInCurrencyInBaseUnits ${amountSellInCurrencyInBaseUnits}`,
	);
	const pnlUSD = await calculateSellTradePNLRaw(
		initialBuyAmountInCurrency,
		amountSellInCurrencyInBaseUnits,
		price,
		tokenDecimals,
	);
	const absoluteValuePNL = Math.abs(pnlUSD);
	elizaLogger.info(`Sell Trade absoluteValuePNL ${absoluteValuePNL}`);
	const formattedPNL = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(absoluteValuePNL);
	elizaLogger.info(`Sell Trade formattedPNL ${formattedPNL}`);
	const formattedPNLUSD = `${pnlUSD <= -0.005 ? "-" : ""}${formattedPNL}`;
	elizaLogger.info(`Sell Trade formattedPNLUSD ${formattedPNLUSD}`);
	return formattedPNLUSD;
};

export const calculateSellTradePNLRaw = async (
	initialBuyAmountInCurrency: number,
	amountSellInCurrencyInBaseUnits: number,
	price: number,
	tokenDecimals: number,
): Promise<number> => {
	// Calculate pnl in raw USD value
	const pnlCurrencyInBaseUnits =
		initialBuyAmountInCurrency - amountSellInCurrencyInBaseUnits;
	const pnlUSD = (pnlCurrencyInBaseUnits / 10 ** tokenDecimals) * price;
	elizaLogger.info(`Sell Trade pnlUSD ${pnlUSD}`);

	return pnlUSD;
};

export async function getTotalBalanceUSD(
	runtime: IAgentRuntime,
	publicKey: `0x${string}`,
): Promise<number> {
	try {
		// Initialize viem client once for all balance checks
		const client = createWalletClient({
			account: privateKeyToAccount(
				`0x${runtime.getSetting("WALLET_PRIVATE_KEY")}` as `0x${string}`,
			),
			chain: base,
			transport: http(runtime.getSetting("ALCHEMY_HTTP_TRANSPORT_URL")),
		}).extend(publicActions);

		// 1. GET ETH BALANCE WITH VIEM
		const ethBalanceBaseUnits = await client.getBalance({
			address: publicKey,
			blockTag: "pending",
		});
		elizaLogger.info(`ethBalanceBaseUnits ${ethBalanceBaseUnits}`);
		const ethBalance = Number(ethBalanceBaseUnits) / 1e18;
		elizaLogger.info(`ethBalance ${ethBalance}`);

		let ethBalanceUSD = 0;
		// Only try to get ETH price if balance is significant
		if (ethBalance > 0.000001) {
			try {
				const priceInquiry = await getPriceInquiry(
					runtime,
					"ETH",
					Number(ethBalanceBaseUnits.toString()),
					"USDC",
					"base",
				);
				if (priceInquiry?.sellAmountBaseUnits) {
					const quote = await getQuoteObj(runtime, priceInquiry, publicKey);
					if (quote?.buyAmount) {
						ethBalanceUSD = Number(quote.buyAmount) / 1e6;
						elizaLogger.info(`ethBalanceUSD ${ethBalanceUSD}`);
					}
				}
			} catch (error) {
				elizaLogger.error("Error getting ETH price:", error);
				// Continue with ethBalanceUSD as 0
			}
		}

		// 2. GET USDC BALANCE WITH VIEM DIRECTLY
		let usdcBalance = 0;
		try {
			const usdcBalanceResult = await client.readContract({
				address: TOKENS.USDC.address as `0x${string}`,
				abi: erc20Abi,
				functionName: "balanceOf",
				args: [publicKey],
			});
			usdcBalance = Number(usdcBalanceResult) / 1e6; // USDC has 6 decimals
			elizaLogger.info(`usdcBalance ${usdcBalance}`);
		} catch (error) {
			elizaLogger.error("Error reading USDC balance with viem:", error);
			// Continue with usdcBalance as 0
		}

		// 3. GET CBBTC BALANCE WITH VIEM DIRECTLY
		let cbbtcBalanceUSD = 0;
		try {
			const cbbtcBalanceResult = await client.readContract({
				address: TOKENS.cbBTC.address as `0x${string}`,
				abi: erc20Abi,
				functionName: "balanceOf",
				args: [publicKey],
			});
			const cbbtcBalance = Number(cbbtcBalanceResult) / 1e8; // BTC typically has 8 decimals
			elizaLogger.info(`cbBTC balance: ${cbbtcBalance}`);

			// Only try to get cbBTC price if balance is significant
			if (cbbtcBalance > 0.00000001) {
				try {
					const cbbtcPriceInquiry = await getPriceInquiry(
						runtime,
						"CBBTC",
						Number(cbbtcBalanceResult.toString()),
						"USDC",
						"base",
					);
					if (cbbtcPriceInquiry?.sellAmountBaseUnits) {
						const cbbtcQuote = await getQuoteObj(
							runtime,
							cbbtcPriceInquiry,
							publicKey,
						);
						if (cbbtcQuote?.buyAmount) {
							cbbtcBalanceUSD = Number(cbbtcQuote.buyAmount) / 1e6;
							elizaLogger.info(`cbbtcBalanceUSD ${cbbtcBalanceUSD}`);
						}
					}
				} catch (error: any) {
					elizaLogger.error("Error getting cbBTC price:", error);
				}
			}
		} catch (error) {
			elizaLogger.error("Error reading cbBTC balance with viem:", error);
			// Continue with cbbtcBalanceUSD as 0
		}

		// Calculate total and return
		const totalBalanceUSD = ethBalanceUSD + usdcBalance + cbbtcBalanceUSD;
		elizaLogger.info(`Total balance USD: ${totalBalanceUSD}`);
		return totalBalanceUSD || 0; // Return 0 if totalBalanceUSD is NaN
	} catch (error: any) {
		elizaLogger.error("Error in getTotalBalanceUSD:", error);
		return 1000; // Default value in case of error
	}
}

export async function getBalance(
	runtime: IAgentRuntime,
	publicKey: `0x${string}`,
	ticker: string,
): Promise<number> {
	const client = createWalletClient({
		account: privateKeyToAccount(
			`0x${runtime.getSetting("WALLET_PRIVATE_KEY")}` as `0x${string}`,
		),
		chain: base,
		transport: http(runtime.getSetting("ALCHEMY_HTTP_TRANSPORT_URL")),
	}).extend(publicActions);

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	let balanceBaseUnits: any;

	switch (ticker.toUpperCase()) {
		case "ETH":
			balanceBaseUnits = await client.getBalance({
				address: publicKey,
				blockTag: "pending",
			});
			elizaLogger.info(`ethBalanceBaseUnits ${balanceBaseUnits}`);
			break;
		case "USDC":
			balanceBaseUnits = await readContractWrapper(
				runtime,
				TOKENS.USDC.address as `0x${string}`,
				"balanceOf",
				{
					account: publicKey,
				},
				"base-mainnet",
				erc20Abi,
			);
			elizaLogger.info(`usdcBalanceBaseUnits ${balanceBaseUnits}`);
			break;
		case "CBBTC":
		case "BTC":
			balanceBaseUnits = await readContractWrapper(
				runtime,
				TOKENS.cbBTC.address as `0x${string}`,
				"balanceOf",
				{
					account: publicKey,
				},
				"base-mainnet",
				erc20Abi,
			);
			elizaLogger.info(`cbbtcBalanceBaseUnits ${balanceBaseUnits}`);
			break;
		default:
			elizaLogger.error(`Unsupported ticker: ${ticker}`);
			return 0;
	}

	return Number(balanceBaseUnits);
}

export async function hasEnoughBalance(
	runtime: IAgentRuntime,
	publicKey: `0x${string}`,
	ticker: string,
	amount: number,
): Promise<boolean> {
	elizaLogger.info(`hasEnoughBalance ${ticker} ${amount}`);
	const balance = await getBalance(runtime, publicKey, ticker);
	elizaLogger.info(`balance ${balance}`);
	const balanceAfterTrade = balance - amount;
	elizaLogger.info(`balanceAfterTrade ${balanceAfterTrade}`);
	return balanceAfterTrade >= 0;
}

export const pnlProvider: Provider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.debug("Starting pnlProvider.get function");
		if (runtime.getSetting("WALLET_PUBLIC_KEY") == null) {
			elizaLogger.error("WALLET_PUBLIC_KEY is null");
			return "";
		}
		try {
			const pnl = await calculateOverallPNL(
				runtime,
				runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`,
				1000,
			);
			elizaLogger.info(`pnl ${pnl}`);
			return `PNL: ${pnl}`;
		} catch (error) {
			elizaLogger.error("Error in pnlProvider: ", error.message);
			return [];
		}
	},
};

export const balanceProvider: Provider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		if (runtime.getSetting("WALLET_PUBLIC_KEY") == null) {
			elizaLogger.error("WALLET_PUBLIC_KEY is null");
			return "";
		}
		const totalBalanceUSD = await getTotalBalanceUSD(
			runtime,
			runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`,
		);
		return `Total balance: $${totalBalanceUSD.toFixed(2)}`;
	},
};

export const addressProvider: Provider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		if (runtime.getSetting("WALLET_PUBLIC_KEY") == null) {
			elizaLogger.error("WALLET_PUBLIC_KEY is null");
			return "";
		}
		return `Base Network Address: ${runtime.getSetting("WALLET_PUBLIC_KEY")} \n ${blockExplorerBaseAddressUrl(runtime.getSetting("WALLET_PUBLIC_KEY"))}`;
	},
};

export const tradingSignalBackTestProvider: Provider = {
	get: async (_runtime: IAgentRuntime, _message: Memory) => {
		const timeFrames = {
			"1D": {
				btc: {
					netProfit: -68.14,
					totalTradesClosed: 7,
					percentageProfitable: 28.57,
					profitFactor: 0.899,
					maxDrawdown: 511.22,
					averageTrade: -9.73,
					numberOfBarsPerTrade: 2045,
					timePeriod: "1D",
				},
			},
			"5D": {
				btc: {
					netProfit: -304.24,
					totalTradesClosed: 68,
					percentageProfitable: 42.65,
					profitFactor: 0.947,
					maxDrawdown: 1662.64,
					averageTrade: -4.47,
					numberOfBarsPerTrade: 155,
					timePeriod: "5D",
				},
			},
			"1M": {
				btc: {
					netProfit: 5604.51,
					totalTradesClosed: 769,
					percentageProfitable: 39.27,
					profitFactor: 1.078,
					maxDrawdown: 8441.55,
					averageTrade: 7.29,
					numberOfBarsPerTrade: 21,
					timePeriod: "1M",
				},
			},
			"3M": {
				btc: {
					netProfit: 3354.51,
					totalTradesClosed: 1002,
					percentageProfitable: 36.93,
					profitFactor: 1.036,
					maxDrawdown: 7159.72,
					averageTrade: 3.35,
					numberOfBarsPerTrade: 14,
					timePeriod: "3M",
				},
			},
		};

		const backtestResults = Object.entries(timeFrames)
			.map(([timeFrame, data]) => {
				return `
            BTC ${timeFrame}: Net Profit: ${data.btc.netProfit}, Total Trades Closed: ${data.btc.totalTradesClosed}, Percentage Profitable: ${data.btc.percentageProfitable}, Profit Factor: ${data.btc.profitFactor}, Max Drawdown: ${data.btc.maxDrawdown}, Average Trade: ${data.btc.averageTrade}, Number of Bars per Trade: ${data.btc.numberOfBarsPerTrade}
            `;
			})
			.join("\n");

		return `
        BACKTEST / TRADING SIGNAL/ STRATEGY RESULTS for tickers being traded actively: 
        TICKER: BTC DIRECTION: LONG 
        ${backtestResults}
		AS OF ${new Date().toLocaleString()} subject to change will be updated periodically
        `;
	},
};

const baseTokenAddressProvider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		return `BASE Token Address: ${runtime.getSetting("COINBASE_TOKEN_ADDRESS_BASE")}`;
	},
};

const solTokenAddressProvider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		return `SOL Token Address: ${runtime.getSetting("COINBASE_TOKEN_ADDRESS_SOL")}`;
	},
};

const stakingLiquidityPoolingProvider = {
	get: async (runtime: IAgentRuntime, _message: Memory) => {
		return `How to stake on BASE: 
		1. Go to uniswap v2 (https://app.uniswap.org/positions/create/v2) and add liquidity to ${runtime.character.username.toUpperCase()} / ETH and receive the LP token 
		2. If you need to bridge RSP accross networks: Solana and Base, go to portalbridge (https://portalbridge.com) to send and receive tokens across networks
  		and follow the instructions in this video (https://x.com/reality_spiral/status/1858612836102222045)
    		3. Go to staking website (https://stakeprosper.com/) and stake your LP tokens and receive rewards 
		Notes you can claim rewards whenever and there is a 7 day lockup period for unstaking.
		How to pool on SOL: Go to raydium (https://raydium.io/liquidity-pools/?token=${runtime.getSetting("COINBASE_TOKEN_ADDRESS_SOL")}) and add liquidity to ${runtime.character.username.toUpperCase()} / ETH and receive rewards you can withdraw anytime`;
	},
};

const whatIsNextProvider: Provider = {
	get: async (_runtime: IAgentRuntime, _message: Memory) => {
		return `Here's what's next:
	  1. New Trading Capabilities:
	  - Margin trading
	  - Short selling

	  2. Relationship based trading:
	  - Getting advice from community members and other traders
	  - Interacting with other trading agents and swarms of agents.
	  
	  Stay tuned for more updates and features!`;
	},
};

const currentPriceProvider = {
	get: async (_runtime: IAgentRuntime, _message: Memory) => {
		// const priceOnBase = await fetchTokenPrice(
		// 	runtime,
		// 	runtime.getSetting("COINBASE_TOKEN_ADDRESS_BASE"),
		// );
		// const aprOnBase = await calculateAPR(
		// 	runtime.getSetting("COINBASE_TOKEN_ADDRESS_BASE"),
		// );
		// return `Current price of ${runtime.character.name.toUpperCase} on Base is ${priceOnBase.current} and APR is ${aprOnBase}.
		// `;
	},
};

export default CoinbaseClientInterface;
