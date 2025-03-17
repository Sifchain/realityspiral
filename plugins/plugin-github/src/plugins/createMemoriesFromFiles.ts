import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
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
	stringToUuid,
} from "@elizaos/core";
import {
	composeContext,
	traceResult,
} from "@realityspiral/plugin-instrumentation";
import { createMemoriesFromFilesTemplate } from "../templates";
import {
	type CreateMemoriesFromFilesContent,
	CreateMemoriesFromFilesSchema,
	isCreateMemoriesFromFilesContent,
} from "../types";
import { getRepoPath, retrieveFiles } from "../utils";

export async function addFilesToMemory(
	runtime: IAgentRuntime,
	message: Memory,
	files: string[],
	repoPath: string,
	owner: string,
	repo: string,
	branch: string,
) {
	elizaLogger.info("Adding files to memory:", files);
	const memories = [];
	for (const file of files) {
		const relativePath = path.relative(repoPath, file);
		// read file and escape new lines with \n
		const content = (await fs.readFile(file, "utf-8")).replace(/\n/g, "\\n");
		const contentHash = createHash("sha256").update(content).digest("hex");
		const memoryId = stringToUuid(
			`github-${owner}-${repo}-${branch}-${relativePath}-${contentHash}`,
		);

		elizaLogger.info("Memory ID:", memoryId);
		const existingDocument =
			await runtime.messageManager.getMemoryById(memoryId);

		if (existingDocument && existingDocument.content.hash === contentHash) {
			continue;
		}

		elizaLogger.log(
			"Processing knowledge for ",
			runtime.character.name,
			" - ",
			relativePath,
		);
		const memory = {
			id: memoryId,
			userId: message.userId,
			agentId: message.agentId,
			roomId: message.roomId,
			content: {
				text: content,
				hash: contentHash,
				source: "github",
				attachments: [],
				metadata: {
					type: "file",
					path: relativePath,
					repo,
					owner,
				},
			},
		} as Memory;
		// elizaLogger.info("Memory:", memory);
		await runtime.messageManager.createMemory(memory);
		memories.push(memory);
	}
}

export const createMemoriesFromFilesAction: Action = {
	name: "CREATE_MEMORIES_FROM_FILES",
	similes: [
		"CREATE_MEMORIES_FROM_FILES",
		"CREATE_MEMORIES",
		"CREATE_MEMORIES_FROM_FILE",
		"MEMORIES_FROM_FILES",
		"MEMORIES_FROM_FILE",
		"GITHUB_CREATE_MEMORIES_FROM_FILES",
		"GITHUB_CREATE_MEMORIES",
		"GITHUB_CREATE_MEMORIES_FROM_FILE",
		"GITHUB_MEMORIES_FROM_FILES",
		"GITHUB_MEMORIES_FROM_FILE",
	],
	description: "Create memories from files in the repository",
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
		//     "[createMemoriesFromFiles] Composing state for message:",
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
			template: createMemoriesFromFilesTemplate,
		});

		// write context to a file
		await fs.writeFile("/tmp/create-memories-from-files-context.txt", context);

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: CreateMemoriesFromFilesSchema,
		});

		// write details to a file
		await fs.writeFile(
			"/tmp/create-memories-from-files-details.txt",
			JSON.stringify(details, null, 2),
		);

		if (!isCreateMemoriesFromFilesContent(details.object)) {
			throw new Error("Invalid content");
		}

		const content = details.object as CreateMemoriesFromFilesContent;

		elizaLogger.info("Creating memories from files...");

		const repoPath = getRepoPath(content.owner, content.repo);
		elizaLogger.info(`Repo path: ${repoPath}`);
		try {
			const files = await retrieveFiles(repoPath, content.path);
			elizaLogger.info(`Files: ${files}`);
			await addFilesToMemory(
				runtime,
				message,
				files,
				repoPath,
				content.owner,
				content.repo,
				content.branch,
			);

			elizaLogger.info("Memories created successfully!");

			const response: Content = {
				text: "Memories created successfully!",
				action: "CREATE_MEMORIES_FROM_FILES",
				source: "github",
				attachments: [],
			};

			// if (callback) {
			//     callback(response);
			// }

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error(
				`Error creating memories from files on ${content.owner}/${content.repo} path ${content.path}:`,
				error,
			);
			if (callback) {
				callback(
					{
						text: `Error creating memories from files on ${content.owner}/${content.repo} path ${content.path}. Please try again.`,
						action: "CREATE_MEMORIES_FROM_FILES",
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
					text: "Create memories from files on repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "CREATE_MEMORIES_FROM_FILES",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Create memories from repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "CREATE_MEMORIES",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Create memories from file in repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "CREATE_MEMORIES_FROM_FILE",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Memories from files in repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "MEMORIES_FROM_FILES",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Memories from file in repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "MEMORIES_FROM_FILE",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub create memories from files in repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "GITHUB_CREATE_MEMORIES_FROM_FILES",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub create memories in repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "GITHUB_CREATE_MEMORIES",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub create memories from file in repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "GITHUB_CREATE_MEMORIES_FROM_FILE",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub memories from files in repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "GITHUB_MEMORIES_FROM_FILES",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "GitHub memories from file in repository octocat/hello-world @ branch main and path 'docs/'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Memories created successfully!",
					action: "GITHUB_MEMORIES_FROM_FILE",
				},
			},
		],
	],
};

export const githubCreateMemorizeFromFilesPlugin: Plugin = {
	name: "githubCreateMemorizeFromFiles",
	description: "Integration with GitHub for creating memories from files",
	actions: [createMemoriesFromFilesAction],
};
