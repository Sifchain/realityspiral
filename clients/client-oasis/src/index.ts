import { EventEmitter } from "node:events";
import {
	type Action,
	type Character,
	type Client,
	type IAgentRuntime,
	type State,
	type UUID,
	elizaLogger,
} from "@elizaos/core";
import * as oasis from "@oasisprotocol/client";
import {
	approveAction,
	claimRewardsAction,
	getRewardsAction,
	getStakedBalanceAction,
	getStakingStrategiesAction,
	mintAction,
	stakeAction,
	unstakeAction,
	unwrapRoseAction,
	wrapRoseAction,
} from "@realityspiral/plugin-accumulated-finance";
import {
	getOptimalPathAction as bitpGetOptimalPathAction,
	monitorPriceStabilityAction as bitpMonitorPriceStabilityAction,
	swapAction as bitpSwapAction,
} from "@realityspiral/plugin-bitprotocol";
import {
	addLiquidityAction as nebyAddLiquidityAction,
	getPoolInfoAction as nebyGetPoolInfoAction,
	getPoolLiquidityAction as nebyGetPoolLiquidityAction,
	monitorPricesAction as nebyMonitorPricesAction,
	removeLiquidityAction as nebyRemoveLiquidityAction,
	swapAction as nebySwapAction,
} from "@realityspiral/plugin-neby";
import {
	getAgentRoflKeyAction,
	getRoflKeyAction,
} from "@realityspiral/plugin-rofl";
import {
	executeSwapAction,
	getSwapQuoteAction,
} from "@realityspiral/plugin-thorn";

// Placeholder types - replace with actual types
type RoflWallet = { address: string; secret: string };
type ActionResult = { success: boolean; data?: any; error?: any };

export class OasisClient extends EventEmitter {
	runtime: IAgentRuntime;
	character: Character;
	stopped: boolean;
	actions: Action[];
	states: Map<UUID, State>;

	constructor(runtime: IAgentRuntime) {
		super();
		this.runtime = runtime;
		this.stopped = false;
		this.character = runtime.character;
		this.states = new Map();

		this.actions = [
			approveAction,
			claimRewardsAction,
			getRewardsAction,
			getStakedBalanceAction,
			getStakingStrategiesAction,
			mintAction,
			stakeAction,
			unstakeAction,
			unwrapRoseAction,
			wrapRoseAction,
			bitpGetOptimalPathAction,
			bitpMonitorPriceStabilityAction,
			bitpSwapAction,
			nebyAddLiquidityAction,
			nebyGetPoolInfoAction,
			nebyGetPoolLiquidityAction,
			executeSwapAction,
			getSwapQuoteAction,
			getAgentRoflKeyAction,
			getRoflKeyAction,
		];

		this.start();
		elizaLogger.info(`Initializing OasisClient for agent ${runtime.agentId}`);
	}

	/**
	 * Perform any asynchronous setup required for the client.
	 */
	async initialize(): Promise<void> {
		elizaLogger.info(
			`OasisClient initialized for agent ${this.runtime.agentId}.`,
		);
	}

	/**
	 * Start any ongoing processes or listeners for the client.
	 */
	async start(): Promise<void> {
		elizaLogger.info(
			`Starting Oasis client for agent ${this.runtime.agentId}...`,
		);

		registerActions(this.runtime, this.actions);
	}

	/**
	 * Stop any ongoing processes and clean up resources.
	 */
	async stop(): Promise<void> {
		this.stopped = true;
		unregisterActions(this.runtime, this.actions);
		elizaLogger.info(
			`OasisClient stopping for agent ${this.runtime.agentId}...`,
		);
	}

	/**
	 * Creates a ROFL wallet and executes actions on other plugins.
	 * This might be triggered by an action, event, or called internally.
	 */
	async executeWorkflow(
		userId?: string /* Or other relevant identifiers */,
	): Promise<{ [key: string]: ActionResult }> {
		if (this.stopped) {
			elizaLogger.warn("executeWorkflow called after client stopped.");
			return {};
		}

		elizaLogger.info("Executing Oasis workflow...", { userId });

		// --- TODO: Replace Mocks with Actual Plugin Logic & Config ---
		const roflOptions = this.runtime.getSetting("ROFL_PLUGIN_OPTIONS") || {};
		const accFinOptions =
			this.runtime.getSetting("ACC_FIN_PLUGIN_OPTIONS") || {};
		const bitpOptions = this.runtime.getSetting("BITP_PLUGIN_OPTIONS") || {};
		const nebyOptions = this.runtime.getSetting("NEBY_PLUGIN_OPTIONS") || {};
		const thornOptions = this.runtime.getSetting("THORN_PLUGIN_OPTIONS") || {};

		elizaLogger.info("Creating ROFL wallet...");
		let wallet: RoflWallet;
		try {
			// wallet = await roflPlugin.createWallet(roflOptions);
			wallet = { address: "mock_address", secret: "mock_secret" }; // Mock wallet
			elizaLogger.info(`Wallet created: ${wallet.address}`);
		} catch (error: any) {
			elizaLogger.error("ROFL wallet creation failed:", error);
			// Decide how to handle wallet creation failure - maybe throw or return error
			return { rofl: { success: false, error: error.message } };
		}

		const results: { [key: string]: ActionResult } = {};

		// Helper function to execute plugin actions
		const executeAction = async (
			pluginName: string,
			actionFn: () => Promise<any>, // Replace 'any' with specific result type if known
		) => {
			try {
				elizaLogger.info(`Executing ${pluginName} action...`);
				const resultData = await actionFn();
				results[pluginName] = { success: true, data: resultData };
				elizaLogger.info(`${pluginName} action complete.`);
			} catch (error: any) {
				elizaLogger.error(`${pluginName} action failed:`, error);
				results[pluginName] = { success: false, error: error.message };
			}
		};

		await executeAction(
			"accumulatedFinance",
			async () =>
				// await accFinPlugin.someAction(wallet, accFinOptions)
				({ mockData: "mock_acc_fin_result" }), // Mock action
		);

		await executeAction(
			"bitProtocol",
			async () =>
				// await bitpPlugin.someAction(wallet, bitpOptions)
				({ mockData: "mock_bitp_result" }), // Mock action
		);

		await executeAction(
			"neby",
			async () =>
				// await nebyPlugin.someAction(wallet, nebyOptions)
				({ mockData: "mock_neby_result" }), // Mock action
		);

		await executeAction(
			"thorn",
			async () =>
				// await thornPlugin.someAction(wallet, thornOptions)
				({ mockData: "mock_thorn_result" }), // Mock action
		);
		// --- End TODO ---

		elizaLogger.info("Oasis workflow finished.");
		return results;
	}
}

// Export a Client interface object, similar to GitHubClientInterface
export const OasisClientInterface: Client = {
	start: async (runtime: IAgentRuntime): Promise<OasisClient> => {
		elizaLogger.info(`Starting OasisClient for agent ${runtime.agentId}`);
		const client = new OasisClient(runtime);
		await client.initialize(); // Ensure initialization is complete
		await client.start(); // Start any background processes
		return client;
	},
	stop: async (runtime: IAgentRuntime): Promise<void> => {
		try {
			elizaLogger.info(`Stopping OasisClient for agent ${runtime.agentId}`);
			if (runtime.clients?.oasis) {
				await runtime.clients.oasis.stop();
			} else {
				elizaLogger.warn(
					`OasisClient instance not found on runtime for agent ${runtime.agentId} during stop.`,
				);
			}
		} catch (e: any) {
			elizaLogger.error(
				`OasisClient stop error for agent ${runtime.agentId}:`,
				e,
			);
			// Optionally capture error: captureError(e, { agentId: runtime.agentId, action: "stop" });
		}
	},
};

export default OasisClientInterface;

export function registerActions(runtime: IAgentRuntime, actions: Action[]) {
	for (const action of actions) {
		runtime.registerAction(action);
	}
}

export function unregisterActions(runtime: IAgentRuntime, actions: Action[]) {
	runtime.actions = runtime.actions.filter(
		(action) => !actions.map((a) => a.name).includes(action.name),
	);
}
