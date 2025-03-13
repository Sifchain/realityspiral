import {
	type Action,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type State,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import { composeContext } from "@realityspiral/plugin-instrumentation";
import { stopTemplate } from "../templates";
import { type StopContent, StopSchema, isStopContent } from "../types";

export const stopAction: Action = {
	name: "STOP",
	similes: [
		"STOP",
		"STOP_OODA_LOOP",
		"STOP_CLIENT",
		"STOP_AGENT",
		"STOP_LOOP",
		"STOP_GITHUB_CLIENT",
		"STOP_GITHUB",
	],
	description: "Stop the OODA loop and wait for user input.",
	validate: async (_runtime: IAgentRuntime) => {
		return true;
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback?: HandlerCallback,
	) => {
		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: stopTemplate,
		});

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: StopSchema,
		});

		if (!isStopContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const _content = details.object as StopContent;

		elizaLogger.info("Stopping the OODA loop from stop action...");

		try {
			elizaLogger.info("OODA loop stopped successfully!");
			if (callback) {
				callback({
					text: "OODA loop stopped successfully!",
					action: "STOP",
				});
			}
		} catch (error) {
			elizaLogger.error("Error stopping the OODA loop:", error);
			if (callback) {
				callback(
					{
						text: "Error stopping the OODA loop. Please try again.",
					},
					[],
				);
			}
		}
	},
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Stop",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Stopped successfully!",
					action: "STOP",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Stop the OODA loop",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "OODA loop stopped successfully!",
					action: "STOP_OODA_LOOP",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Stop the client",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Client stopped successfully!",
					action: "STOP_CLIENT",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Stop the agent",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Agent stopped successfully!",
					action: "STOP_AGENT",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Stop the loop",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Loop stopped successfully!",
					action: "STOP_LOOP",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Stop the github client",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Github client stopped successfully!",
					action: "STOP_GITHUB_CLIENT",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Stop github",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Github stopped successfully!",
					action: "STOP_GITHUB",
				},
			},
		],
	],
};
