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
import { createCommitTemplate } from "../templates";
import {
	type CreateCommitContent,
	CreateCommitSchema,
	isCreateCommitContent,
} from "../types";
import {
	checkoutBranch,
	commitAndPushChanges,
	getRepoPath,
	writeFiles,
} from "../utils";

export const createCommitAction: Action = {
	name: "CREATE_COMMIT",
	similes: [
		"COMMIT",
		"COMMIT_CHANGES",
		"CREATE_COMMIT",
		"GITHUB_COMMIT",
		"GITHUB_CREATE_COMMIT",
		"GITHUB_COMMIT_CHANGES",
	],
	description: "Commit changes to the repository",
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
		// elizaLogger.log("[createCommit] Composing state for message:", message);
		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: createCommitTemplate,
		});
		// await fs.writeFile(
		//     "createCommitContext.json",
		//     JSON.stringify(context, null, 2),
		// );
		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: CreateCommitSchema,
		});

		if (!isCreateCommitContent(details.object)) {
			const errorMessage = "Invalid content";
			elizaLogger.error(`${errorMessage}: ${details.object}`);
			captureError(new Error(errorMessage), {
				action: "createCommit",
				object: details.object,
			});
			throw new Error(errorMessage);
		}

		const content = details.object as CreateCommitContent;
		// await fs.writeFile(
		//     "createCommit.json",
		//     JSON.stringify(content, null, 2),
		// );
		elizaLogger.info(
			`Committing changes to the repository ${content.owner}/${content.repo} on branch ${content.branch}...`,
		);

		const repoPath = getRepoPath(content.owner, content.repo);

		try {
			const token = runtime.getSetting("GITHUB_API_TOKEN");

			await checkoutBranch(repoPath, content.branch, true);
			await writeFiles(repoPath, content.files);
			const commit = await commitAndPushChanges(
				token,
				repoPath,
				content.message,
				content.branch,
			);
			const hash = commit.commit;
			elizaLogger.info(
				`Commited changes to the repository ${content.owner}/${content.repo} successfully to branch '${content.branch}'! commit hash: ${hash}`,
			);

			const response: Content = {
				text: `Changes commited to repository ${content.owner}/${content.repo} successfully to branch '${content.branch}'! commit hash: ${hash}`,
				attachments: [],
			};

			if (callback) {
				callback(response);
			}

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error(
				`Error committing to the repository ${content.owner}/${content.repo} on branch '${content.branch}' message ${content.message}: See error: ${error.message}`,
			);
			captureError(error as Error, {
				message: content.message,
				branch: content.branch,
				owner: content.owner,
				repo: content.repo,
				action: "createCommit",
			});
			if (callback) {
				callback(
					{
						text: `Error committing to the repository ${content.owner}/${content.repo} on branch '${content.branch}' message ${content.message}. Please try again See error: ${error.message}.`,
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
					text: "Commit changes to the repository user1/repo1 on branch 'main' with the commit message: 'Initial commit'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Changes commited to repository user1/repo1 successfully to branch 'main'! commit hash: abcdef1",
					action: "COMMIT",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Commit changes to the repository user1/repo1 on branch 'main' with the commit message: 'Update README'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Changes commited to repository user1/repo1 successfully to branch 'main'! commit hash: abcdef2",
					action: "COMMIT_CHANGES",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Create a commit in the repository user1/repo1 on branch 'main' with the commit message: 'Fix bug'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Changes commited to repository user1/repo1 successfully to branch 'main'! commit hash: abcdef3",
					action: "CREATE_COMMIT",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Commit changes to the GitHub repository user1/repo1 on branch 'main' with the commit message: 'Add new feature'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Changes commited to repository user1/repo1 successfully to branch 'main'! commit hash: abcdef4",
					action: "GITHUB_COMMIT",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Create a commit in the GitHub repository user1/repo1 on branch 'main' with the commit message: 'Refactor code'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Changes commited to repository user1/repo1 successfully to branch 'main'! commit hash: abcdef5",
					action: "GITHUB_CREATE_COMMIT",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Commit changes to the GitHub repository user1/repo1 on branch 'main' with the commit message: 'Improve performance'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Changes commited to repository user1/repo1 successfully to branch 'main'! commit hash: abcdef6",
					action: "GITHUB_COMMIT_CHANGES",
				},
			},
		],
	],
};

export const githubCreateCommitPlugin: Plugin = {
	name: "githubCreateCommit",
	description:
		"Integration with GitHub for committing changes to the repository",
	actions: [createCommitAction],
};
