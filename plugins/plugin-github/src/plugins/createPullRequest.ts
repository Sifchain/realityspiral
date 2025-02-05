import {
    composeContext,
    elizaLogger,
    generateObject,
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    Plugin,
    State,
} from "@elizaos/core";
import { createPullRequestTemplate } from "../templates";
import {
    CreatePullRequestContent,
    CreatePullRequestSchema,
    isCreatePullRequestContent,
} from "../types";
import {
    checkoutBranch,
    commitAndPushChanges,
    createPullRequest,
    getRepoPath,
    writeFiles,
    saveCreatedPullRequestToMemory,
} from "../utils";
import fs from "fs/promises";

export const createPullRequestAction: Action = {
    name: "CREATE_PULL_REQUEST",
    similes: [
        "CREATE_PULL_REQUEST",
        "CREATE_PR",
        "GENERATE_PR",
        "PULL_REQUEST",
        "GITHUB_CREATE_PULL_REQUEST",
        "GITHUB_PR",
        "GITHUB_GENERATE_PR",
        "GITHUB_PULL_REQUEST",
    ],
    description: "Create a pull request",
    validate: async (runtime: IAgentRuntime) => {
        // Check if all required environment variables are set
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");

        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        // elizaLogger.log(
        //     "[createPullRequest] Composing state for message:",
        //     message
        // );
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: createPullRequestTemplate,
        });

        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: CreatePullRequestSchema,
        });

        if (!isCreatePullRequestContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as CreatePullRequestContent;

        elizaLogger.info("Creating a pull request...");

        const repoPath = getRepoPath(content.owner, content.repo);

        try {
            await checkoutBranch(repoPath, content.branch, true);
            await writeFiles(repoPath, content.files);
            await commitAndPushChanges(repoPath, content.title, content.branch);
            const pullRequest = await createPullRequest(
                runtime.getSetting("GITHUB_API_TOKEN"),
                content.owner,
                content.repo,
                content.branch,
                content.title,
                content.description,
                content.base,
            );
            await saveCreatedPullRequestToMemory(
                runtime,
                message,
                pullRequest,
                content.owner,
                content.repo,
                content.branch,
                runtime.getSetting("GITHUB_API_TOKEN"),
            );

            elizaLogger.info(
                `Pull request created successfully! URL: ${pullRequest.html_url}`,
            );
            if (callback) {
                callback({
                    text: `Pull request created successfully! URL: ${pullRequest.html_url}`,
                    attachments: [],
                });
            }
            return pullRequest;
        } catch (error) {
            elizaLogger.error(
                `Error creating pull request on ${content.owner}/${content.repo} branch ${content.branch}:`,
                error,
            );
            if (callback) {
                callback(
                    {
                        text: `Error creating pull request on ${content.owner}/${content.repo} branch ${content.branch}. Please try again.`,
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
                    text: "Create a pull request on repository octocat/hello-world with branch 'fix/something' against base 'develop', title 'fix: something' and files 'docs/architecture.md' '# Architecture Documentation'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/1 @ branch: 'fix/something'",
                    action: "CREATE_PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create PR on repository octocat/hello-world with branch 'feature/new-feature' against base 'develop', title 'feat: new feature' and files 'src/app.js' '# new app.js file'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/2 @ branch: 'feature/new-feature'",
                    action: "CREATE_PR",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Generate PR on repository octocat/hello-world with branch 'hotfix/urgent-fix' against base 'develop', title 'fix: urgent fix' and files 'lib/something.go' '# go file'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/3 @ branch: 'hotfix/urgent-fix'",
                    action: "GENERATE_PR",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a pull request on repository octocat/hello-world with branch 'chore/update-deps' against base 'develop', title 'chore: update dependencies' and files 'package.json' '{\"name\": \"new-package\"}'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/4 @ branch: 'chore/update-deps'",
                    action: "PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub create pull request on repository octocat/hello-world with branch 'docs/update-readme' against base 'develop', title 'docs: update README' and files 'README.md' '# New README\nSomething something'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/5 @ branch: 'docs/update-readme'",
                    action: "GITHUB_CREATE_PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub PR on repository octocat/hello-world with branch 'refactor/code-cleanup' against base 'develop', title 'refactor: code cleanup' and files 'src/refactored_file.txt' 'Refactored content'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/6 @ branch: 'refactor/code-cleanup'",
                    action: "GITHUB_PR",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub generate PR on repository octocat/hello-world with branch 'test/add-tests' against base 'develop', title 'test: add tests' and files 'tests/e2e.test.ts' '# E2E test cases'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/7 @ branch: 'test/add-tests'",
                    action: "GITHUB_GENERATE_PR",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub pull request on repository octocat/hello-world with branch 'ci/update-workflow' against base 'develop', title 'ci: update workflow' and files '.github/workflows/ci.yaml' '# new CI workflow'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/8 @ branch: 'ci/update-workflow'",
                    action: "GITHUB_PULL_REQUEST",
                },
            },
        ],
    ],
};

export const githubCreatePullRequestPlugin: Plugin = {
    name: "githubCreatePullRequest",
    description: "Integration with GitHub for creating a pull request",
    actions: [createPullRequestAction],
};
