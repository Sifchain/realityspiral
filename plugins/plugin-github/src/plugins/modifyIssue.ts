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
import { GitHubService } from "../services/github";
import {
    ModifyIssueContent,
    ModifyIssueSchema,
    isModifyIssueContent,
} from "../types";
import { modifyIssueTemplate } from "../templates";

export const modifyIssueAction: Action = {
    name: "MODIFY_ISSUE",
    similes: ["MODIFY_ISSUE", "UPDATE_ISSUE", "EDIT_ISSUE"],
    description: "Modifies an existing issue in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
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
        // elizaLogger.log("[modifyIssue] Composing state for message:", message);

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: modifyIssueTemplate,
        });

        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: ModifyIssueSchema,
        });

        if (!isModifyIssueContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as ModifyIssueContent;

        elizaLogger.info("Modifying issue in the repository...");

        const token = runtime.getSetting("GITHUB_API_TOKEN");
        if (!token) {
            elizaLogger.error("GITHUB_API_TOKEN is not set");
            throw new Error("GITHUB_API_TOKEN is not set");
        }

        const githubService = new GitHubService({
            owner: content.owner,
            repo: content.repo,
            auth: token,
        });

        try {
            const issue = await githubService.updateIssue(content.issue, {
                title: content.title,
                body: content.body,
                state: content.state as "open" | "closed",
                labels: content.labels,
            });

            elizaLogger.info(`Modified issue #${issue.number} successfully!`);

            if (callback) {
                callback({
                    text: `Modified issue #${issue.number} successfully!`,
                    attachments: [],
                });
            }
        } catch (error) {
            elizaLogger.error(
                `Error modifying issue #${content.issue} in repository ${content.owner}/${content.repo}:`,
                error,
            );

            if (callback) {
                callback(
                    {
                        text: `Error modifying issue #${content.issue}. Please try again.`,
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
                    text: "Update issue #1 in repository user1/repo1 to add the label 'bug'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Modified issue #1 successfully!",
                    action: "MODIFY_ISSUE",
                },
            },
        ],
    ],
};

export const githubModifyIssuePlugin: Plugin = {
    name: "githubModifyIssue",
    description: "Integration with GitHub for modifying existing issues",
    actions: [modifyIssueAction],
};
