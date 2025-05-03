import type { Plugin } from "@elizaos/core";
import {
	addLiquidityAction,
	getPoolInfoAction,
	getPoolLiquidityAction,
	monitorPricesAction,
	removeLiquidityAction,
	swapAction,
} from "./plugins/neby";

// Export the plugin in the format expected by the agent
export const nebyPlugin: Plugin = {
	name: "neby", // Use a simple name for lookup
	description: "Plugin for interacting with Neby DEX on Oasis Sapphire",
	actions: [
		swapAction,
		addLiquidityAction,
		removeLiquidityAction,
		monitorPricesAction,
		getPoolLiquidityAction,
		getPoolInfoAction,
	],
	providers: [], // No providers defined yet
};

// Re-export types and constants for external use
export * from "./types";
export * from "./constants";
export * from "./plugins/neby";
