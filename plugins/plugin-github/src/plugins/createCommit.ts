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
import { createCommitTemplate } from "../templates";
import {
    CreateCommitContent,
    CreateCommitSchema,
    isCreateCommitContent,
} from "../types";
import {
    commitAndPushChanges,
    getRepoPath,
    writeFiles,
    checkoutBranch,
} from "../utils";
import fs from "fs/promises";

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
        options?: any,
        callback?: HandlerCallback,
    ) => {
        // elizaLogger.log("[createCommit] Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
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
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
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
            await checkoutBranch(repoPath, content.branch, true);
            await writeFiles(repoPath, content.files);
            const commit = await commitAndPushChanges(
                repoPath,
                content.message,
                content.branch,
            );
            const hash = commit.commit;
            elizaLogger.info(
                `Commited changes to the repository ${content.owner}/${content.repo} successfully to branch '${content.branch}'! commit hash: ${hash}`,
            );
            if (callback) {
                callback({
                    text: `Changes commited to repository ${content.owner}/${content.repo} successfully to branch '${content.branch}'! commit hash: ${hash}`,
                    attachments: [],
                });
            }
            return commit;
        } catch (error) {
            elizaLogger.error(
                `Error committing to the repository ${content.owner}/${content.repo} on branch '${content.branch}' message ${content.message}: See error: ${error.message}`,
            );
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
