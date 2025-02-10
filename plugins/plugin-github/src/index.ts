import type { Plugin } from "@elizaos/core";
import {
	createCommitAction,
	githubCreateCommitPlugin,
} from "./plugins/createCommit";
import {
	createIssueAction,
	githubCreateIssuePlugin,
} from "./plugins/createIssue";
import {
	createMemoriesFromFilesAction,
	githubCreateMemorizeFromFilesPlugin,
} from "./plugins/createMemoriesFromFiles";
import {
	createPullRequestAction,
	githubCreatePullRequestPlugin,
} from "./plugins/createPullRequest";
import { githubIdeationPlugin, ideationAction } from "./plugins/ideationPlugin";
import {
	githubInitializePlugin,
	initializeRepositoryAction,
} from "./plugins/initializeRepository";
import {
	addCommentToIssueAction,
	closeIssueAction,
	githubInteractWithIssuePlugin,
	reactToIssueAction,
} from "./plugins/interactWithIssue";
import {
	addCommentToPRAction,
	closePRAction,
	generateCodeFileChangesAction,
	githubInteractWithPRPlugin,
	implementFeatureAction,
	mergePRAction,
	reactToPRAction,
	replyToPRCommentAction,
} from "./plugins/interactWithPR";
import {
	githubModifyIssuePlugin,
	modifyIssueAction,
} from "./plugins/modifyIssue";
import {
	githubOrchestratePlugin,
	orchestrateAction,
} from "./plugins/orchestrate";
import { documentationFilesProvider } from "./providers/documentationFiles";
import { releasesProvider } from "./providers/releases";
import { sourceCodeProvider } from "./providers/sourceCode";
import { testFilesProvider } from "./providers/testFiles";
import { workflowFilesProvider } from "./providers/workflowFiles";
import { githubForkRepositoryPlugin } from "./plugins/forkRepository";

export const plugins = {
	githubInitializePlugin,
	githubCreateMemorizeFromFilesPlugin,
	githubCreatePullRequestPlugin,
	githubCreateCommitPlugin,
	githubCreateIssuePlugin,
	githubModifyIssuePlugin,
	githubInteractWithIssuePlugin,
	githubInteractWithPRPlugin,
	githubIdeationPlugin,
	githubOrchestratePlugin,
	githubForkRepositoryPlugin,
};

export * from "./plugins/initializeRepository";
export * from "./plugins/createMemoriesFromFiles";
export * from "./plugins/createPullRequest";
export * from "./plugins/createCommit";
export * from "./plugins/createIssue";
export * from "./plugins/modifyIssue";
export * from "./plugins/interactWithIssue";
export * from "./plugins/ideationPlugin";
export * from "./plugins/interactWithPR";
export * from "./plugins/orchestrate";

export * from "./providers/sourceCode";
export * from "./providers/testFiles";
export * from "./providers/workflowFiles";
export * from "./providers/documentationFiles";
export * from "./providers/releases";
export * from "./utils";
export * from "./services/github";
export * from "./templates";
export * from "./types";
export * from "./constants";

export const githubPlugin: Plugin = {
	name: "github",
	description: "Integration with GitHub",
	actions: [
		initializeRepositoryAction,
		createMemoriesFromFilesAction,
		createPullRequestAction,
		createCommitAction,
		createIssueAction,
		modifyIssueAction,
		addCommentToIssueAction,
		ideationAction,
		addCommentToPRAction,
		mergePRAction,
		closePRAction,
		reactToPRAction,
		closePRAction,
		reactToIssueAction,
		closeIssueAction,
		replyToPRCommentAction,
		generateCodeFileChangesAction,
		implementFeatureAction,
		orchestrateAction,
	],
	evaluators: [],
	providers: [
		sourceCodeProvider,
		testFilesProvider,
		workflowFilesProvider,
		documentationFilesProvider,
		releasesProvider,
	],
};

export default githubPlugin;
