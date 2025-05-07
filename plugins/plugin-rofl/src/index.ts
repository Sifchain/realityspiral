import type { Plugin } from "@elizaos/core";
import { getAgentRoflKeyAction } from "./actions/getAgentRoflKey";
import { getRoflKeyAction } from "./actions/getRoflKey";
import { getRoflKeyProvider } from "./providers/getRoflKey";

export const roflPlugin: Plugin = {
	name: "rofl",
	description: "Rofl Plugin for Eliza",
	actions: [getRoflKeyAction, getAgentRoflKeyAction],
	evaluators: [],
	providers: [getRoflKeyProvider],
};

export * from "./actions/getAgentRoflKey";
export * from "./actions/getRoflKey";
export * from "./providers/getRoflKey";

export default roflPlugin;
