import fs from "node:fs/promises";
import {
	type Action,
	type Content,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type Plugin,
	type State,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import {
	composeContext,
	traceResult,
} from "@realityspiral/plugin-instrumentation";
import { captureError } from "@realityspiral/sentry";
import { GitHubService } from "../services/github";
import {
	createIssueTemplate,
	similarityIssueCheckTemplate,
} from "../templates";
import {
	type CreateIssueContent,
	CreateIssueSchema,
	type SimilarityIssueCheckContent,
	SimilarityIssueCheckSchema,
	isCreateIssueContent,
	isSimilarityIssueCheckContent,
} from "../types";
import { saveIssueToMemory } from "../utils";

export const createIssueAction: Action = {
	name: "CREATE_ISSUE",
	similes: ["CREATE_ISSUE", "GITHUB_CREATE_ISSUE", "OPEN_ISSUE"],
	description: "Creates a new issue in the GitHub repository",
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
		// elizaLogger.log("[createIssue] Composing state for message:", message);

		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message, {})) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: createIssueTemplate,
		});

		// write context to file
		await fs.writeFile("/tmp/context-create-issue.txt", context);

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: CreateIssueSchema,
		});

		if (!isCreateIssueContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const content = details.object as CreateIssueContent;

		// write content to file
		await fs.writeFile(
			"/tmp/content-create-issue.json",
			JSON.stringify(content, null, 2),
		);

		elizaLogger.info("Creating issue in the repository...");

		const githubService = new GitHubService({
			owner: content.owner,
			repo: content.repo,
			branch: content.branch,
			auth: runtime.getSetting("GITHUB_API_TOKEN"),
		});

		const issuesLimit = Number(runtime.getSetting("GITHUB_ISSUES_LIMIT")) || 10;

		const issues = await githubService.getIssues(issuesLimit);

		state.existingIssues = issues
			.map(
				(issue) =>
					// `* #${issue.number} - ${issue.title}: \`\`\`${issue.body.replace(/\n/g, ' ')}\`\`\``,
					`* #${issue.number} - ${issue.title}`,
			)
			.join("\n");
		state.title = content.title;
		state.body = content.body.replace(/\n/g, "\\n").replace(/`/g, "\\`");

		const similarityCheckContext = composeContext({
			state,
			template: similarityIssueCheckTemplate,
		});

		// write context to file
		await fs.writeFile(
			"/tmp/context-similarity-check.txt",
			similarityCheckContext,
		);

		const similarityCheckDetails = await generateObject({
			runtime,
			context: similarityCheckContext,
			modelClass: ModelClass.SMALL,
			schema: SimilarityIssueCheckSchema,
		});

		if (!isSimilarityIssueCheckContent(similarityCheckDetails.object)) {
			elizaLogger.error("Invalid content:", similarityCheckDetails.object);
			throw new Error("Invalid content");
		}

		const similarityCheckContent =
			similarityCheckDetails.object as SimilarityIssueCheckContent;

		// write content to file
		await fs.writeFile(
			"/tmp/content-similarity-check.json",
			JSON.stringify(similarityCheckContent, null, 2),
		);

		try {
			if (similarityCheckContent.created) {
				const issue = await githubService.createIssue(
					content.title,
					content.body,
					content.labels,
				);

				elizaLogger.info(
					`Created issue successfully! Issue number: ${issue.number}`,
				);

				const memory = await saveIssueToMemory(
					message.userId,
					runtime,
					message,
					issue,
				);

				if (callback) {
					await callback(memory.content);
				}

				return traceResult(state, memory.content);
			}

			elizaLogger.info(
				`Issue already exists! Issue number: ${similarityCheckContent.issue}`,
			);

			const response: Content = {
				text: `Issue already exists! Issue number: ${similarityCheckContent.issue}`,
				action: "CREATE_ISSUE",
				source: "github",
				attachments: [],
			};

			if (callback) {
				await callback(response);
			}

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error creating issue:", error);
			captureError(error as Error, {
				title: content.title,
				owner: content.owner,
				repo: content.repo,
				action: "createIssue",
			});
			if (callback) {
				await callback(
					{
						text: `Error creating issue in repository ${content.owner}/${content.repo}. Please try again.`,
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
					text: "Create an issue in repository user1/repo1 titled 'Bug: Application crashes on startup'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Created issue #1 successfully!",
					action: "CREATE_ISSUE",
				},
			},
		],
		// issue already exists
		[
			{
				user: "{{user1}}",
				content: {
					text: "Create an issue in repository user1/repo1 titled 'Feature: Add a clickable button to the UI'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Issue already exists! Issue number: 1",
					action: "CREATE_ISSUE",
				},
			},
		],
	],
};

export const githubCreateIssuePlugin: Plugin = {
	name: "githubCreateIssue",
	description: "Integration with GitHub for creating issues in repositories",
	actions: [createIssueAction],
	evaluators: [],
	providers: [],
};
