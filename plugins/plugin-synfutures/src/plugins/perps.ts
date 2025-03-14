import {
	type Action,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type Plugin,
	type State,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import {
	composeContext,
	traceResult,
} from "@realityspiral/plugin-instrumentation";
import type { Side } from "@synfutures/sdks-perp";
import { Wallet } from "ethers";
import * as ethers from "ethers";
import {
	closePositionTemplate,
	depositToGateTemplate,
	getPortfolioTemplate,
	placeMarketOrderTemplate,
	withdrawFromGateTemplate,
} from "../templates";
import {
	ClosePositionContent,
	ClosePositionSchema,
	DepositToGateContent,
	DepositToGateSchema,
	GetPortfolioContent,
	GetPortfolioSchema,
	PlaceMarketOrderContent,
	PlaceMarketOrderSchema,
	WithdrawFromGateContent,
	WithdrawFromGateSchema,
	isClosePositionContent,
	isDepositToGateContent,
	isGetPortfolioContent,
	isPlaceMarketOrderContent,
	isWithdrawFromGateContent,
} from "../types";
import {
	addLiquidity,
	adjustPositionLeverage,
	adjustPositionMargin,
	cancelAllLimitOrders,
	cancelLimitOrder,
	closePosition,
	depositToGate,
	getAllInstruments,
	getInstrumentBySymbol,
	getPortfolio,
	initContext,
	placeBatchScaledLimitOrders,
	placeCrossMarketOrder,
	placeLimitOrder,
	placeMarketOrder,
	removeLiquidity,
	withdrawFromGate,
} from "../utils/perpUtils";

// Add a flag to track context initialization
let isContextInitialized = false;

// Create a singleton for provider and signer
let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;

export function getProviderAndSigner() {
	if (!provider || !signer) {
		provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
		signer = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
	}
	return { provider, signer };
}

// Define actions for each utility function

export const initContextAction: Action = {
	name: "INIT_CONTEXT",
	description: "Initialize the SynFutures Perp context.",
	similes: ["INIT_CONTEXT", "INITIALIZE_CONTEXT"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Initialize the SynFutures Perp context",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Context initialized successfully.",
				},
			},
		],
	],
	validate: async (_runtime: IAgentRuntime) => true,
	handler: async (
		_runtime: IAgentRuntime,
		_message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.info("Initializing SynFutures Perp context...");
		try {
			if (!isContextInitialized) {
				await initContext();
				isContextInitialized = true;
				elizaLogger.info("Context initialized successfully.");
			}

			const response = { text: "Context initialized successfully." };
			callback(response, []);
			traceResult(state, response);
		} catch (error) {
			const response = {
				text: `Failed to initialize context: ${error.message}`,
			};
			callback(response, []);
			traceResult(state, response);
		}
	},
};

export const getAllInstrumentsAction: Action = {
	name: "GET_ALL_INSTRUMENTS",
	description: "Retrieve all available instruments.",
	similes: ["GET_ALL_INSTRUMENTS", "FETCH_INSTRUMENTS"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Get all available instruments",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Retrieved 10 instruments.",
				},
			},
		],
	],
	validate: async (_runtime: IAgentRuntime) => true,
	handler: async (
		_runtime: IAgentRuntime,
		_message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.info("Fetching all instruments...");
		try {
			if (!isContextInitialized) {
				await initContext();
				isContextInitialized = true;
				elizaLogger.info("Context initialized successfully.");
			}
			const instruments = await getAllInstruments();
			elizaLogger.info("Instruments retrieved successfully.", instruments);

			const response = { text: `Retrieved ${instruments.length} instruments.` };
			callback(response, []);
			traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error fetching instruments: ", error.message);
			const response = {
				text: `Failed to fetch instruments: ${error.message}`,
			};
			callback(response, []);
			traceResult(state, response);
		}
	},
};

export const depositToGateAction: Action = {
	name: "DEPOSIT_TO_GATE",
	description: "Deposit funds to the gate.",
	similes: ["DEPOSIT_TO_GATE", "FUND_GATE"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Deposit 100 USDC to the gate",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Deposited 100 USDC to the gate successfully.",
				},
			},
		],
	],
	validate: async (_runtime: IAgentRuntime) => true,
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.info("Depositing to gate...");
		try {
			if (!isContextInitialized) {
				await initContext();
				isContextInitialized = true;
				elizaLogger.info("Context initialized successfully.");
			}

			const { signer } = getProviderAndSigner();

			if (!state) {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = (await runtime.composeState(message, {})) as State;
			} else {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = await runtime.updateRecentMessageState(state);
			}

			const context = composeContext({
				state,
				template: depositToGateTemplate,
			});

			const details = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: DepositToGateSchema,
			});

			if (!isDepositToGateContent(details.object)) {
				elizaLogger.error("Invalid content:", details.object);
				throw new Error("Invalid content");
			}

			const { tokenSymbol, amount } = details.object;
			await depositToGate(tokenSymbol, amount, signer);
			elizaLogger.info("Deposit successful.");

			const response = { text: "Deposited successfully." };
			callback(response, []);
			traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error depositing to gate: ", error.message);
			const response = { text: `Failed to deposit: ${error.message}` };
			callback(response, []);
			traceResult(state, response);
		}
	},
};

export const placeMarketOrderAction: Action = {
	name: "PLACE_MARKET_ORDER",
	description: "Place a market order.",
	similes: ["PLACE_MARKET_ORDER", "EXECUTE_MARKET_ORDER"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Place a market order for 1 BTC",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Market order for 1 BTC placed successfully.",
				},
			},
		],
	],
	validate: async (_runtime: IAgentRuntime) => true,
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.info("Placing market order...");
		try {
			if (!isContextInitialized) {
				await initContext();
				isContextInitialized = true;
				elizaLogger.info("Context initialized successfully.");
			}

			const { signer } = getProviderAndSigner();

			if (!state) {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = (await runtime.composeState(message, {})) as State;
			} else {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = await runtime.updateRecentMessageState(state);
			}

			const context = composeContext({
				state,
				template: placeMarketOrderTemplate,
			});

			const details = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: PlaceMarketOrderSchema,
			});

			if (!isPlaceMarketOrderContent(details.object)) {
				elizaLogger.error("Invalid content:", details.object);
				throw new Error("Invalid content");
			}

			const { instrumentSymbol, side, quoteAmount, leverage } = details.object;
			await placeMarketOrder(
				instrumentSymbol,
				side as unknown as Side,
				quoteAmount,
				leverage,
				signer,
			);
			elizaLogger.info("Market order placed successfully.");

			const response = { text: "Market order placed successfully." };
			callback(response, []);
			traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error placing market order: ", error.message);
			const response = {
				text: `Failed to place market order: ${error.message}`,
			};
			callback(response, []);
			traceResult(state, response);
		}
	},
};

export const closePositionAction: Action = {
	name: "CLOSE_POSITION",
	description: "Close an open position.",
	similes: ["CLOSE_POSITION", "EXIT_POSITION"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Close my BTC position",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "BTC position closed successfully.",
				},
			},
		],
	],
	validate: async (_runtime: IAgentRuntime) => true,
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.info("Closing position...");
		try {
			if (!state) {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = (await runtime.composeState(message, {})) as State;
			} else {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = await runtime.updateRecentMessageState(state);
			}

			const context = composeContext({
				state,
				template: closePositionTemplate,
			});

			const details = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: ClosePositionSchema,
			});

			if (!isClosePositionContent(details.object)) {
				elizaLogger.error("Invalid content:", details.object);
				throw new Error("Invalid content");
			}

			const { instrumentSymbol } = details.object;
			const { signer } = getProviderAndSigner();
			await closePosition(instrumentSymbol, signer);
			elizaLogger.info("Position closed successfully.");

			const response = { text: "Position closed successfully." };
			callback(response, []);
			traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error closing position: ", error.message);
			const response = { text: `Failed to close position: ${error.message}` };
			callback(response, []);
			traceResult(state, response);
		}
	},
};

export const withdrawFromGateAction: Action = {
	name: "WITHDRAW_FROM_GATE",
	description: "Withdraw funds from the gate.",
	similes: ["WITHDRAW_FROM_GATE", "REMOVE_FUNDS"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Withdraw 50 USDC from the gate",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Withdrew 50 USDC from the gate successfully.",
				},
			},
		],
	],
	validate: async (_runtime: IAgentRuntime) => true,
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.info("Withdrawing from gate...");
		try {
			if (!state) {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = (await runtime.composeState(message, {})) as State;
			} else {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = await runtime.updateRecentMessageState(state);
			}

			const context = composeContext({
				state,
				template: withdrawFromGateTemplate,
			});

			const details = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: WithdrawFromGateSchema,
			});

			if (!isWithdrawFromGateContent(details.object)) {
				elizaLogger.error("Invalid content:", details.object);
				throw new Error("Invalid content");
			}

			const { tokenSymbol, amount } = details.object;
			const { signer } = getProviderAndSigner();
			await withdrawFromGate(tokenSymbol, amount, signer);
			elizaLogger.info("Withdrawal successful.");

			const response = { text: "Withdrawal successful." };
			callback(response, []);
			traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error withdrawing from gate: ", error.message);
			const response = { text: `Failed to withdraw: ${error.message}` };
			callback(response, []);
			traceResult(state, response);
		}
	},
};

export const getPortfolioAction: Action = {
	name: "GET_PORTFOLIO",
	description: "Retrieve the user's portfolio.",
	similes: ["GET_PORTFOLIO", "FETCH_PORTFOLIO"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Show my portfolio",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Here is your portfolio: ...",
				},
			},
		],
	],
	validate: async (_runtime: IAgentRuntime) => true,
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.info("Retrieving portfolio...");
		try {
			if (!state) {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = (await runtime.composeState(message, {})) as State;
			} else {
				// biome-ignore lint/style/noParameterAssign: <explanation>
				state = await runtime.updateRecentMessageState(state);
			}

			const context = composeContext({
				state,
				template: getPortfolioTemplate,
			});

			const details = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: GetPortfolioSchema,
			});

			if (!isGetPortfolioContent(details.object)) {
				elizaLogger.error("Invalid content:", details.object);
				throw new Error("Invalid content");
			}

			const { walletAddress } = details.object;
			const instrumentAddr = "exampleInstrumentAddr"; // Example instrument address
			const expiry = 4294967295; // Example expiry
			const portfolio = await getPortfolio(
				walletAddress,
				instrumentAddr,
				expiry,
			);
			elizaLogger.info("Portfolio retrieved successfully.", portfolio);

			const response = { text: "Portfolio retrieved successfully." };
			callback(response, []);
			traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error retrieving portfolio: ", error.message);
			const response = {
				text: `Failed to retrieve portfolio: ${error.message}`,
			};
			callback(response, []);
			traceResult(state, response);
		}
	},
};

export const synfuturesPerpPlugin: Plugin = {
	name: "synfuturesPerpPlugin",
	description: "Plugin for interacting with SynFutures Perpetual contracts.",
	actions: [
		initContextAction,
		getAllInstrumentsAction,
		depositToGateAction,
		placeMarketOrderAction,
		closePositionAction,
		withdrawFromGateAction,
		getPortfolioAction,
	],
};

export { placeMarketOrder };
