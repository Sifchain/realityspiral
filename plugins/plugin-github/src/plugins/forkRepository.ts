import {
	type Action,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type Plugin,
	type State,
	composeContext,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import { GitHubService } from "../services/github";
import { forkRepositoryTemplate } from "../templates";
import {
	type ForkRepositoryContent,
	ForkRepositorySchema,
	isForkRepositoryContent,
} from "../types";

export const forkRepositoryAction: Action = {
	name: "FORK_REPOSITORY",
	similes: [
		"FORK_REPO",
		"FORK",
		"GITHUB_FORK",
		"GITHUB_FORK_REPO",
		"GITHUB_FORK_REPOSITORY",
		"CREATE_FORK",
	],
	description: "Forks a GitHub repository",
	validate: async (runtime: IAgentRuntime) => {
		const token = !!runtime.getSetting("GITHUB_API_TOKEN");
		return token;
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

		const context = composeContext({
			state,
			template: forkRepositoryTemplate,
		});

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: ForkRepositorySchema,
		});

		if (!isForkRepositoryContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const content = details.object as ForkRepositoryContent;

		elizaLogger.info(`Forking repository ${content.owner}/${content.repo}...`);

		const githubService = new GitHubService({
			owner: content.owner,
			repo: content.repo,
			auth: runtime.getSetting("GITHUB_API_TOKEN"),
		});

		try {
			const fork = await githubService.forkRepository(
				content.owner,
				content.repo,
				content.organization,
			);

			elizaLogger.info(`Repository forked successfully! URL: ${fork.html_url}`);

			if (callback) {
				callback({
					text: `Repository forked successfully! URL: ${fork.html_url}`,
					action: "FORK_REPOSITORY",
					source: "github",
					attachments: [],
				});
			}

			return fork;
		} catch (error) {
			elizaLogger.error(
				`Error forking repository ${content.owner}/${content.repo}:`,
				error,
			);

			if (callback) {
				callback(
					{
						text: `Error forking repository ${content.owner}/${content.repo}. Please try again.`,
						action: "FORK_REPOSITORY",
						source: "github",
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
					text: "Fork repository octocat/Hello-World",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository forked successfully! URL: https://github.com/user1/Hello-World",
					action: "FORK_REPOSITORY",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Create a fork of repository octocat/Hello-World to my-org organization",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository forked successfully! URL: https://github.com/my-org/Hello-World",
					action: "FORK_REPOSITORY",
				},
			},
		],
	],
};

export const githubForkRepositoryPlugin: Plugin = {
	name: "githubForkRepository",
	description: "Integration with GitHub for forking repositories",
	actions: [forkRepositoryAction],
};
