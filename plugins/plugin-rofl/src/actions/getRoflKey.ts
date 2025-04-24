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
import { composeContext } from "@realityspiral/plugin-instrumentation";
import type { KeyKind } from "../types";
import { RoflService } from "../services/rofl";

const roflService = new RoflService();

export const getRoflKeyAction: Action = {
	name: "GET_ROFL_KEY",
	similes: [
		"GENERATE_KEY",
		"CREATE_KEY",
		"ROFL_KEY",
		"ROFL_GENERATE_KEY",
		"ROFL_CREATE_KEY",
	],
	description: "Generate a cryptographic key using ROFL service",
	validate: async (_runtime: IAgentRuntime) => {
		try {
			await roflService.generateKey({ key_id: "test", kind: "secp256k1" });
			return true;
		} catch {
			return false;
		}
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: { key_id: string; kind: KeyKind },
		callback?: HandlerCallback,
	) => {
		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		if (!options?.key_id || !options?.kind) {
			const error = new Error("Missing required parameters: key_id and kind");
			if (callback) {
				callback({ text: error.message });
			}
			throw error;
		}

		const _context = composeContext({
			state,
			template: "Generating key with ROFL service",
		});

		try {
			const response = await roflService.generateKey({
				key_id: options.key_id,
				kind: options.kind,
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
				action: "getRoflKey",
				key_id: options.key_id,
				kind: options.kind,
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
					text: "Generate a secp256k1 key with ID 'my-key'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Generated key successfully: <key>",
					action: "GET_ROFL_KEY",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Create an ed25519 key with ID 'test-key'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Generated key successfully: <key>",
					action: "GENERATE_KEY",
				},
			},
		],
	],
};
