import type { Plugin } from "@elizaos/core";
import { getRoflKeyAction } from "./actions/getRoflKey";
import { getAgentRoflKeyAction } from "./actions/getAgentRoflKey";
import { getRoflKeyProvider } from "./providers/getRoflKey";

export const roflPlugin: Plugin = {
	name: "rofl",
	description: "Rofl Plugin for Eliza",
	actions: [getRoflKeyAction, getAgentRoflKeyAction],
	evaluators: [],
	providers: [getRoflKeyProvider],
};

export default roflPlugin;
