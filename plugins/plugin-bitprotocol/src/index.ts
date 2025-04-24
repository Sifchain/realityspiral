import type { Plugin } from "@elizaos/core";
import {
	swapAction,
	monitorPriceStabilityAction,
	getOptimalSwapPathAction,
	privateSwapAction,
} from "./plugins/bitprotocol";

export const bitProtocolPlugin: Plugin = {
	name: "bitProtocol", // Simple name for plugin registration/lookup
	description:
		"Plugin for interacting with BitProtocol on Oasis Sapphire (Swaps, Price Feed, Path Finding).",
	actions: [
		swapAction,
		monitorPriceStabilityAction,
		getOptimalSwapPathAction,
		privateSwapAction,
	],
	providers: [], // Add if the plugin offers any data providers
	evaluators: [], // Add if the plugin offers any evaluators
	services: [], // Add if the plugin offers any services
};

export * from "./types";
// export * from "./constants"; // Decide if constants need exporting