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
    AddCommentToIssueContent,
    AddCommentToIssueSchema,
    GenerateCommentForASpecificPRSchema,
    isAddCommentToIssueContent,
    isGenerateCommentForASpecificPRSchema,
    ReactToIssueContent,
    ReactToIssueSchema,
    isReactToIssueContent,
    CloseIssueActionContent,
    CloseIssueActionSchema,
    isCloseIssueActionContent,
} from "../types";
import {
    addCommentToIssueTemplate,
    generateCommentForASpecificIssueTemplate,
    reactToIssueTemplate,
    closeIssueTemplate,
} from "../templates";
import { getIssueFromMemories } from "../utils";

export const addCommentToIssueAction: Action = {
    name: "COMMENT_ON_ISSUE",
    similes: [
        "ADD_COMMENT_TO_ISSUE",
        "COMMENT_ON_ISSUE",
        "POST_COMMENT_ON_ISSUE",
        "POST_COMMENT_TO_ISSUE",
        "ADD_COMMENT_ON_ISSUE",
        "ADD_COMMENT_TO_ISSUE",
    ],
    description: "Adds a comment to an existing issue in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
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
        // elizaLogger.log(
        //     "[addCommentToIssue] Composing state for message:",
        //     message
        // );
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: addCommentToIssueTemplate,
        });

        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: AddCommentToIssueSchema,
        });

        if (!isAddCommentToIssueContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as AddCommentToIssueContent;

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

        let issue = await getIssueFromMemories(runtime, message, content.issue);
        if (!issue) {
            elizaLogger.error("Issue not found in memories");

            let issueData = await githubService.getIssue(content.issue);
            const issueDetails = {
                type: "issue",
                url: issueData.html_url,
                number: issueData.number,
                state: issueData.state,
                created_at: issueData.created_at,
                updated_at: issueData.updated_at,
                comments: await githubService.getIssueCommentsText(
                    issueData.comments_url,
                ),
                labels: issueData.labels.map((label: any) =>
                    typeof label === "string" ? label : label?.name,
                ),
                body: issueData.body,
            };
            state.specificIssue = JSON.stringify(issueDetails);
        } else {
            state.specificIssue = JSON.stringify(issue.content);
        }
        const commentContext = composeContext({
            state,
            template: generateCommentForASpecificIssueTemplate,
        });

        const commentDetails = await generateObject({
            runtime,
            context: commentContext,
            modelClass: ModelClass.SMALL,
            schema: GenerateCommentForASpecificPRSchema,
        });

        if (!isGenerateCommentForASpecificPRSchema(commentDetails.object)) {
            elizaLogger.error(
                "Invalid comment content:",
                commentDetails.object,
            );
            throw new Error("Invalid comment content");
        }

        const commentBody = commentDetails.object.comment;
        const emojiReaction = commentDetails.object.emojiReaction;
        elizaLogger.info("Adding comment to issue in the repository...", {
            issue,
            commentBody,
        });

        try {
            const comment = await githubService.addIssueComment(
                content.issue,
                commentBody,
                emojiReaction,
            );

            elizaLogger.info(
                `Added comment to issue #${content.issue} successfully! See comment at ${comment.html_url}`,
            );
            if (callback) {
                callback({
                    text: `Added comment to issue #${content.issue} successfully! See comment at ${comment.html_url}`,
                    attachments: [],
                });
            }
        } catch (error) {
            elizaLogger.error(
                `Error adding comment to issue #${content.issue} in repository ${content.owner}/${content.repo}:`,
                error,
            );
            if (callback) {
                callback(
                    {
                        text: `Error adding comment to issue #${content.issue}. Please try again.`,
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
                    text: "Add a comment to issue #1 in repository user1/repo1: 'This is fixed in the latest release'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to issue #1 successfully! See comment at https://github.com/user1/repo1/issues/1#issuecomment-1234567890",
                    action: "COMMENT_ON_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user2}}",
                content: {
                    text: "Add a comment to issue #2 in repository user2/repo2: 'Can you provide more details on this issue?'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to issue #2 successfully! See comment at https://github.com/user2/repo2/issues/2#issuecomment-0987654321",
                    action: "COMMENT_ON_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user3}}",
                content: {
                    text: "Add a comment to issue #3 in repository user3/repo3: 'We are working on a fix for this issue.'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to issue #3 successfully! See comment at https://github.com/user3/repo3/issues/3#issuecomment-1122334455",
                    action: "COMMENT_ON_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user4}}",
                content: {
                    text: "Add a comment to issue #4 in repository user4/repo4: 'This issue has been prioritized.'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to issue #4 successfully! See comment at https://github.com/user4/repo4/issues/4#issuecomment-6677889900",
                    action: "COMMENT_ON_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user5}}",
                content: {
                    text: "Add a comment to issue #5 in repository user5/repo5: 'Please check the latest update for a resolution.'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to issue #5 successfully! See comment at https://github.com/user5/repo5/issues/5#issuecomment-5544332211",
                    action: "COMMENT_ON_ISSUE",
                },
            },
        ],
    ],
};

export const reactToIssueAction: Action = {
    name: "REACT_TO_ISSUE",
    similes: ["REACT_TO_ISSUE", "ADD_REACTION_ISSUE", "POST_REACTION_ISSUE"],
    description:
        "Adds a reaction to a comment in an issue in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
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
        // elizaLogger.log("[reactToIssue] Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: reactToIssueTemplate,
        });
        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: ReactToIssueSchema,
        });

        if (!isReactToIssueContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }
        
        const content = details.object as ReactToIssueContent;

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

        elizaLogger.info("Adding reaction to issue comment...");

        try {
            const reaction = await githubService.createReactionForIssue(
                content.owner,
                content.repo,
                content.issue,
                content.reaction,
            );
            const issue = await githubService.getIssue(content.issue);

            elizaLogger.info("Reaction:", JSON.stringify(reaction, null, 2));
            elizaLogger.info(
                `Added reaction to issue #${content.issue} successfully! Issue: ${issue.html_url}`,
            );

            if (callback) {
                callback({
                    text: `Added reaction to issue #${content.issue} successfully! Issue: ${issue.html_url}`,
                    attachments: [],
                });
            }
        } catch (error) {
            elizaLogger.error(
                `Error adding reaction to issue #${content.issue} in repository ${content.owner}/${content.repo}:`,
                error,
            );
            if (callback) {
                callback(
                    {
                        text: `Error adding reaction to issue #${content.issue}. Please try again.`,
                    },
                    [],
                );
            }
        }
    },
    examples: [
        [
            {
                user: "{{user}}",
                content: {
                    text: "React to issue #1 in repository user1/repo1 with a heart",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added reaction to issue #1 successfully!",
                    action: "REACT_TO_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "React to issue #2 in repository user2/repo2 with a thumbs up",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added reaction to issue #2 successfully!",
                    action: "REACT_TO_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "React to issue #3 in repository user3/repo3 with a laugh",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added reaction to issue #3 successfully!",
                    action: "REACT_TO_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "React to issue #4 in repository user4/repo4 with a hooray",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added reaction to issue #4 successfully!",
                    action: "REACT_TO_ISSUE",
                },
            },
        ],
    ],
};

export const closeIssueAction: Action = {
    name: "CLOSE_ISSUE",
    similes: ["CLOSE_ISSUE", "CLOSE_GITHUB_ISSUE"],
    description: "Closes an issue in the GitHub repository",
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
        // elizaLogger.log("[closeIssue] Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: closeIssueTemplate,
        });
        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: CloseIssueActionSchema,
        });

        if (!isCloseIssueActionContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as CloseIssueActionContent;

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
        elizaLogger.info("Closing issue...");

        try {
            const issue = await githubService.updateIssue(content.issue, {
                state: "closed",
                labels: ["agent-close"],
            });

            elizaLogger.info("Issue:", JSON.stringify(issue, null, 2));
            elizaLogger.info(`Closed issue #${content.issue} successfully!`);

            if (callback) {
                callback({
                    text: `Closed issue #${content.issue} successfully! Issue: ${issue.html_url}`,
                    attachments: [],
                });
            }
        } catch (error) {
            elizaLogger.error(
                `Error closing issue #${content.issue} in repository ${content.owner}/${content.repo}:`,
                error,
            );
            if (callback) {
                callback(
                    {
                        text: `Error closing issue #${content.issue}. Please try again.`,
                    },
                    [],
                );
            }
        }
    },
    examples: [
        [
            {
                user: "{{user}}",
                content: {
                    text: "Close issue #1 in repository user1/repo1",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Closed issue #1 successfully!",
                    action: "CLOSE_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Close issue #2 in repository user2/repo2",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Closed issue #2 successfully!",
                    action: "CLOSE_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Close issue #3 in repository user3/repo3",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Closed issue #3 successfully!",
                    action: "CLOSE_ISSUE",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Close issue #4 in repository user4/repo4",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Closed issue #4 successfully!",
                    action: "CLOSE_ISSUE",
                },
            },
        ],
    ],
};

export const githubInteractWithIssuePlugin: Plugin = {
    name: "githubInteractWithIssue",
    description:
        "Integration with GitHub for adding comments or reactions or closing issues",
    actions: [reactToIssueAction, addCommentToIssueAction, closeIssueAction],
};
