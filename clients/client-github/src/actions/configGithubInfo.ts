import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger,
    composeContext,
    ModelClass,
    generateObject,
} from "@elizaos/core";
import {
    ConfigGithubInfoContent,
    ConfigGithubInfoSchema,
    isConfigGithubInfoContent,
} from "../types";
import { configGithubInfoTemplate } from "../templates";

export const configGithubInfoAction: Action = {
    name: "CONFIG_GITHUB_INFO",
    similes: [
        "CONFIG_GITHUB_INFO",
        "CONFIGURE_GITHUB_INFO",
        "SETUP_GITHUB_INFO",
        "DEFINE_GITHUB_INFO",
        "GITHUB_INFO",
        "GITHUB_REPO_INFO",
        "GITHUB_REPO_CONFIG",
        "GITHUB_REPO_SETUP",
        "GITHUB_REPO_DEFINE",
    ],
    description: "Configure information from GitHub repositories",
    validate: async (runtime: IAgentRuntime) => {
        // Check if all required environment variables are set
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");

        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback?: HandlerCallback
    ) => {
        // elizaLogger.log(
        //     "[configGithubInfoAction] Composing state for message:",
        //     message
        // );

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: configGithubInfoTemplate,
        });

        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: ConfigGithubInfoSchema,
        });

        if (!isConfigGithubInfoContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as ConfigGithubInfoContent;

        elizaLogger.info(
            `Configuring GitHub repository ${content.owner}/${content.repo} on branch ${content.branch}...`,
        );

        try {
            elizaLogger.info(
                `Repository configured successfully! URL: https://github.com/${content.owner}/${content.repo} @ branch: ${content.branch}`,
            );

            if (callback) {
                callback({
                    text: `GitHub repository configured successfully! Repository URL: https://github.com/${content.owner}/${content.repo} @ branch ${content.branch}`,
                    attachments: [],
                });
            }
        } catch (error) {
            elizaLogger.error(
                `Error configuring repository ${content.owner}/${content.repo} branch ${content.branch}:`,
                error,
            );
            if (callback) {
                callback(
                    {
                        text: `Error configuring repository ${content.owner}/${content.repo} branch ${content.branch}. Please try again.`,
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
                    text: "Configure the GitHub repository user1/repo1 on main branch",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "GitHub repository configured successfully! Repository URL: https://github.com/user1/repo1 @ branch main",
                    action: "CONFIG_GITHUB_INFO",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Setup GitHub info for repository user1/repo1",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "GitHub repository information has been set up successfully! Repository URL: https://github.com/user1/repo1",
                    action: "SETUP_GITHUB_INFO",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Define GitHub info for my new repository user1/repo1",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "GitHub repository information has been defined! Repository URL: https://github.com/user1/repo1",
                    action: "DEFINE_GITHUB_INFO",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get GitHub repo info for user1/repo1",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the GitHub repository information for user1/repo1",
                    action: "GITHUB_INFO",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Setup GitHub repo config for user1/repo1 development branch",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "GitHub repository configuration complete! Repository URL: https://github.com/user1/repo1 @ branch development",
                    action: "GITHUB_REPO_CONFIG",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Define GitHub repo setup for user1/repo1",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "GitHub repository setup has been defined! Repository URL: https://github.com/user1/repo1",
                    action: "GITHUB_REPO_SETUP",
                },
            },
        ],
    ],
};
