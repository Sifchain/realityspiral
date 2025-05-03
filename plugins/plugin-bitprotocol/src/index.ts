import type { Plugin } from "@elizaos/core";
import {
	getOptimalPathAction,
	monitorPriceStabilityAction,
	swapAction,
} from "./plugins/bitprotocol";

// Main consolidated plugin export
export const bitProtocolPlugin: Plugin = {
	name: "bitProtocol",
	description:
		"Plugin for interacting with BitProtocol on Oasis Sapphire (Swaps, Price Feed, Path Finding).",
	actions: [swapAction, monitorPriceStabilityAction, getOptimalPathAction],
	providers: [],
	evaluators: [],
	services: [],
};

export * from "./types";
export * from "./plugins/bitprotocol";
