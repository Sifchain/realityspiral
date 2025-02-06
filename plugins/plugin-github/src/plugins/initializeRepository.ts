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
import { initializeTemplate } from "../templates";
import {
	type InitializeContent,
	InitializeSchema,
	isInitializeContent,
} from "../types";
import {
	checkoutBranch,
	cloneOrPullRepository,
	createReposDirectory,
	getRepoPath,
} from "../utils";

export const initializeRepositoryAction: Action = {
	name: "INITIALIZE_REPOSITORY",
	similes: [
		"INITIALIZE_REPOSITORY",
		"INITIALIZE_REPO",
		"INIT_REPO",
		"GITHUB_INITIALIZE_REPOSITORY",
		"GITHUB_INIT_REPO",
		"GITHUB_INIT",
		"GITHUB_INITIALIZE",
		"GITHUB_INITIALIZE_REPO",
		"GITHUB_INIT_REPOSITORY",
	],
	description: "Initialize the repository",
	validate: async (runtime: IAgentRuntime) => {
		// Check if all required environment variables are set
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
		// elizaLogger.log(
		//     "[initializeRepository] Composing state for message:",
		//     message
		// );
		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: initializeTemplate,
		});

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			schema: InitializeSchema as any,
		});

		if (!isInitializeContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const content = details.object as InitializeContent;

		elizaLogger.info(
			`Initializing repository ${content.owner}/${content.repo} on branch ${content.branch}...`,
		);

		const repoPath = getRepoPath(content.owner, content.repo);

		elizaLogger.info(`Repository path: ${repoPath}`);

		try {
			const token = runtime.getSetting("GITHUB_API_TOKEN");
			if (!token) {
				throw new Error("GITHUB_API_TOKEN is not set");
			}

			await createReposDirectory(content.owner);
			await cloneOrPullRepository(
				token,
				content.owner,
				content.repo,
				repoPath,
				content.branch,
			);
			await checkoutBranch(repoPath, content.branch);

			elizaLogger.info(
				`Repository initialized successfully! URL: https://github.com/${content.owner}/${content.repo} @ branch: ${content.branch}`,
			);
			if (callback) {
				callback({
					text: `Repository initialized successfully! URL: https://github.com/${content.owner}/${content.repo} @ branch: ${content.branch}`,
					action: "INITIALIZE_REPOSITORY",
					source: "github",
					attachments: [],
				});
			}
		} catch (error) {
			elizaLogger.error(
				`Error initializing repository ${content.owner}/${content.repo} branch ${content.branch}:`,
				error,
			);
			if (callback) {
				callback(
					{
						text: `Error initializing repository ${content.owner}/${content.repo} branch ${content.branch}. Please try again.`,
						action: "INITIALIZE_REPOSITORY",
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
					text: "Initialize the repository user1/repo1 on main branch",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository initialized successfully! URL: https://github.com/user1/repo1",
					action: "INITIALIZE_REPOSITORY",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Initialize the repo user1/repo1 on main branch",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository initialized successfully! URL: https://github.com/user1/repo1",
					action: "INITIALIZE_REPO",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Init repo user1/repo1 on main branch",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository initialized successfully! URL: https://github.com/user1/repo1",
					action: "INIT_REPO",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub initialize repository user1/repo1 on main branch",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository initialized successfully! URL: https://github.com/user1/repo1",
					action: "GITHUB_INITIALIZE_REPOSITORY",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub init repo user1/repo1 on main branch",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository initialized successfully! URL: https://github.com/user1/repo1",
					action: "GITHUB_INIT_REPO",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub init user1/repo1 on main branch",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository initialized successfully! URL: https://github.com/user1/repo1",
					action: "GITHUB_INIT",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub initialize user1/repo1 on main branch",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository initialized successfully! URL: https://github.com/user1/repo1",
					action: "GITHUB_INITIALIZE",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub initialize repo user1/repo1 on main branch",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository initialized successfully! URL: https://github.com/user1/repo1",
					action: "GITHUB_INITIALIZE_REPO",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub init repository user1/repo1 on main branch",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Repository initialized successfully! URL: https://github.com/user1/repo1",
					action: "GITHUB_INIT_REPOSITORY",
				},
			},
		],
	],
};

export const githubInitializePlugin: Plugin = {
	name: "githubInitialize",
	description: "Integration with GitHub for initializing the repository",
	actions: [initializeRepositoryAction],
};
