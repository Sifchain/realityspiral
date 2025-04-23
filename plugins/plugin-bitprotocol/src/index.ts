import type { Plugin } from "@elizaos/core";
import {
	swapAction,
	monitorPriceStabilityAction,
	getOptimalSwapPathAction,
} from "./actions/bitprotocolActions";

// Export the plugin in the format expected by the agent runtime
export const bitProtocolPlugin: Plugin = {
	name: "bitProtocol", // Simple name for plugin registration/lookup
	description:
		"Plugin for interacting with BitProtocol on Oasis Sapphire (Swaps, Price Feed, Path Finding).",
	actions: [swapAction, monitorPriceStabilityAction, getOptimalSwapPathAction],
	// providers: [], // Add if the plugin offers any data providers
	// evaluators: [], // Add if the plugin offers any evaluators
	// services: [], // Add if the plugin offers any services
};

// Optionally re-export types if needed elsewhere, though actions handle their own i/o types
// export * from "./types";
// export * from "./constants"; // Constants might be useful externally 