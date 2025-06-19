import type { Plugin } from "@elizaos/core";
import { getAgentPublicAddressAction } from "./actions/getAgentPublicAddress";
import { getAgentWalletAddressProvider } from "./providers/getAgentWalletAddressProvider";

export const roflPlugin: Plugin = {
	name: "rofl",
	description: "Rofl Plugin for Eliza",
	actions: [getAgentPublicAddressAction],
	evaluators: [],
	providers: [getAgentWalletAddressProvider],
};

export * from "./actions/getAgentPublicAddress";
export * from "./providers/getAgentWalletAddressProvider";
export * from "./services/rofl";

export default roflPlugin;
