import type { Plugin } from "@elizaos/core";
import {
	approveAction,
	claimRewardsAction,
	getRewardsAction,
	getStakedBalanceAction,
	getStakingStrategiesAction,
	mintAction,
	redeemAction,
	stakeAction,
	unstakeAction,
	unwrapRoseAction,
	wrapRoseAction,
} from "./plugins/accumulated";

// Export the plugin in the format expected by the agent
export const accumulatedFinancePlugin: Plugin = {
	name: "accumulatedFinance", // Use a simpler name for lookup
	description:
		"Plugin for interacting with Accumulated Finance's staking contracts on Oasis Sapphire",
	actions: [
		stakeAction,
		unstakeAction,
		getRewardsAction,
		claimRewardsAction,
		getStakingStrategiesAction,
		getStakedBalanceAction,
		wrapRoseAction,
		unwrapRoseAction,
		mintAction,
		approveAction,
		redeemAction,
	],
	providers: [], // No providers defined yet
};

// Re-export types and constants for external use if needed
export * from "./types";
export * from "./constants";

// Re-export ContractHelper from plugin-coinbase for convenience, if still desired
// export { ContractHelper } from "@realityspiral/plugin-coinbase"; // Optional
