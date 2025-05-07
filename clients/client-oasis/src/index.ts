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
			nebyMonitorPricesAction,
			nebyRemoveLiquidityAction,
			nebySwapAction,
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
