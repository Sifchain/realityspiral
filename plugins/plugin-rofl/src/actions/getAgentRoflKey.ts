import {
	type Action,
	type Content,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	type State,
	elizaLogger,
} from "@elizaos/core";
import { captureError } from "@realityspiral/sentry";
import { RoflService } from "../services/rofl";

const roflService = new RoflService();

export const getAgentRoflKeyAction: Action = {
	name: "GET_AGENT_ROFL_KEY",
	similes: [
		"GENERATE_AGENT_KEY",
		"CREATE_AGENT_KEY",
		"AGENT_ROFL_KEY",
		"AGENT_ROFL_GENERATE_KEY",
		"AGENT_ROFL_CREATE_KEY",
	],
	description: "Display a cryptographic key of the agent using ROFL service",
	validate: async (runtime: IAgentRuntime) => {
		try {
			await roflService.generateKey({
				key_id: runtime.agentId,
				kind: "secp256k1",
			});
			return true;
		} catch {
			return false;
		}
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	) => {
		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		try {
			const response = await roflService.generateKey({
				key_id: runtime.agentId,
				kind: "secp256k1",
			});

			const responseContent: Content = {
				text: `Generated key successfully: ${response.key}`,
				attachments: [],
			};

			if (callback) {
				callback(responseContent);
			}

			return responseContent;
		} catch (error) {
			elizaLogger.error(`Error generating key: ${error.message}`);
			captureError(error as Error, {
				action: "getAgentRoflKey",
				key_id: runtime.agentId,
				kind: "secp256k1",
			});

			const errorContent: Content = {
				text: `Error generating key: ${error.message}`,
				attachments: [],
			};

			if (callback) {
				callback(errorContent);
			}

			throw error;
		}
	},
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Show me the agent ROLF key",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Here is the agent ROFL key: <key>",
					action: "GET_AGENT_ROFL_KEY",
				},
			},
		],
	],
};
