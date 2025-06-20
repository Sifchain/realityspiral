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

export const getAgentPublicAddressAction: Action = {
	name: "GET_AGENT_PUBLIC_ADDRESS",
	similes: [
		"SHOW_AGENT_WALLET",
		"AGENT_WALLET_ADDRESS",
		"AGENT_PUBLIC_ADDRESS",
		"GET_AGENT_WALLET",
		"SHOW_AGENT_ADDRESS",
		"AGENT_FUNDING_ADDRESS",
	],
	description:
		"Display the agent's wallet public address for funding DeFi interactions",
	validate: async (runtime: IAgentRuntime) => {
		try {
			await roflService.getAgentWallet(runtime.agentId);
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
			const wallet = await roflService.getAgentWallet(runtime.agentId);

			const publicAddress = wallet.address;

			const responseContent: Content = {
				text: `Here is your agent's wallet public address: **${publicAddress}**

To enable this agent to interact with DeFi protocols (Neby, BitProtocol, Thorn, Accumulated Finance), please fund this wallet address with the required tokens. The agent will use these funds to execute trades, swaps, and other DeFi operations on your behalf.

**Important:** Only send funds to this address that you're comfortable with the agent using for automated DeFi activities.`,
				attachments: [],
			};

			if (callback) {
				callback(responseContent);
			}

			return responseContent;
		} catch (error) {
			elizaLogger.error(
				`Error generating agent public address: ${error.message}`,
			);
			captureError(error as Error, {
				action: "getAgentPublicAddress",
				agent_id: runtime.agentId,
			});

			const errorContent: Content = {
				text: `Error generating agent public address: ${error.message}`,
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
					text: "Show me the agent's wallet address",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Here is your agent's wallet public address: **0x...**\n\nTo enable this agent to interact with DeFi protocols (Neby, BitProtocol, Thorn, Accumulated Finance), please fund this wallet address with the required tokens.",
					action: "GET_AGENT_PUBLIC_ADDRESS",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "What's the agent's funding address?",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Here is your agent's wallet public address: **0x...**\n\nTo enable this agent to interact with DeFi protocols (Neby, BitProtocol, Thorn, Accumulated Finance), please fund this wallet address with the required tokens.",
					action: "GET_AGENT_PUBLIC_ADDRESS",
				},
			},
		],
	],
};
