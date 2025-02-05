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
    stringToUuid,
} from "@elizaos/core";
import { ideationTemplate } from "../templates";
import { IdeationSchema, isIdeationContent } from "../types";

export const ideationAction: Action = {
    name: "IDEATION",
    similes: [
        "THINK",
        "IDEATE",
        "IDEAS",
        "IDEATION",
        "CO_CREATION",
        "BRAINSTORM",
        "THOUGHTS",
        "SUGGESTIONS",
        "THINKING",
    ],
    description:
        "Generates ideas and suggestions based on user message using the context of the files and previous messages",
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
        // elizaLogger.log("[ideation] Composing state for message:", message);

        if (!state) {
            state = (await runtime.composeState(message, {})) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: ideationTemplate,
        });

        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: IdeationSchema,
        });

        if (!isIdeationContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object;

        elizaLogger.info("Generating ideas based on the context...");

        const timestamp = Date.now();
        const userIdUUID = stringToUuid(`${runtime.agentId}-${timestamp}`);
        const memoryUUID = stringToUuid(
            `${message.roomId}-${runtime.agentId}-${timestamp}`,
        );

        const newMemory: Memory = {
            id: memoryUUID,
            userId: userIdUUID,
            agentId: runtime.agentId,
            content: {
                text: content.response,
                action: "IDEATION",
                source: "github",
                inReplyTo: stringToUuid(`${message.roomId}-${runtime.agentId}`),
            },
            roomId: message.roomId,
            createdAt: timestamp,
        };

        await runtime.messageManager.createMemory(newMemory);

        if (callback) {
            await callback({
                text: content.response,
                attachments: [],
            });
        }
    },
    examples: [
        [
            {
                user: "{{user}}",
                content: {
                    text: "Think about ways to enhance the security of user1/repo1",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Based on the current state of the repository and previous interactions, here are some detailed suggestions:\n\n1. **Enhance Documentation**: The README could be expanded with more comprehensive setup instructions and examples, which aligns with previous feedback from contributors. Consider adding a 'Getting Started' section to guide new users.\n2. **Refactor Legacy Code**: Several modules identified in past code reviews could be refactored for better maintainability. Focus on the `utils` directory, which has been flagged for complexity in previous pull requests.\n3. **Increase Test Coverage**: Previous issues highlighted gaps in test coverage, particularly in the authentication module. Implementing unit tests for edge cases could improve reliability.\n4. **Optimize Database Queries**: Recent performance logs suggest that certain database queries could be optimized to reduce load times. Look into indexing strategies for frequently queried tables.\n5. **Implement CI/CD Pipeline**: Automating the deployment process was a recurring suggestion in past discussions, which could improve efficiency and reduce errors. Consider using GitHub Actions for seamless integration.",
                    action: "IDEATION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Ideate on improving the frontend of user2/repo2",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Analyzing the repository and considering previous user feedback, here are some frontend improvement ideas:\n\n1. **Redesign UI for Better UX**: The current design could be more intuitive. Implementing a modern design framework like Material-UI could enhance user experience.\n2. **Improve Accessibility**: Past user feedback has pointed out accessibility issues. Implementing ARIA roles and ensuring color contrast could be beneficial. Consider using tools like Lighthouse to audit accessibility.\n3. **Optimize Asset Loading**: There are opportunities to lazy-load images and scripts to improve page load times, as noted in previous performance audits. This could significantly enhance the user experience on slower networks.\n4. **Enhance State Management**: Transitioning to a more robust state management solution like Redux could address issues raised in past bug reports, particularly those related to data consistency.\n5. **Implement Responsive Design**: Ensuring the application is fully responsive was a common request in user surveys. Use CSS Grid and Flexbox to create a fluid layout that adapts to different screen sizes.",
                    action: "IDEATION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Generate ideas for backend improvements in user3/repo3",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here are some backend improvement suggestions, taking into account the repository's history and current state:\n\n1. **Optimize API Endpoints**: Previous performance tests indicate that certain API endpoints could be optimized for faster response times. Consider implementing pagination for data-heavy endpoints.\n2. **Implement Caching Strategies**: Introducing caching for frequently accessed data could significantly reduce server load, as discussed in past meetings. Tools like Redis could be beneficial here.\n3. **Enhance Security Protocols**: A security audit revealed potential vulnerabilities that should be addressed to protect user data. Implementing OAuth 2.0 for authentication could enhance security.\n4. **Improve Error Logging**: Enhancing the logging system to capture more detailed error information could aid in faster debugging, as suggested in recent retrospectives. Consider using structured logging with tools like Logstash.\n5. **Refactor Monolithic Services**: Consider breaking down monolithic services into microservices to improve scalability and maintainability. This approach was recommended in previous architecture reviews.",
                    action: "IDEATION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Co-create ideas for improving the deployment process of user4/repo4",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here are some deployment process improvement ideas, informed by past deployment logs and team feedback:\n\n1. **Automate Deployment with CI/CD**: Implementing a CI/CD pipeline could streamline the deployment process and reduce manual errors, as previously discussed. GitHub Actions or Jenkins could be used for this purpose.\n2. **Implement Blue-Green Deployments**: This strategy could minimize downtime and allow for safer rollbacks, which was a concern raised in past incidents. It also provides a seamless user experience during updates.\n3. **Containerize Applications**: Using Docker to containerize applications can ensure consistency across environments, as suggested in previous technical meetings. This approach also simplifies scaling and deployment.\n4. **Monitor Deployment Metrics**: Setting up monitoring tools to track deployment success and application performance post-deployment could provide valuable insights. Tools like Prometheus and Grafana could be integrated for real-time monitoring.\n5. **Optimize Build Process**: Reviewing and optimizing the build process to reduce build times was a recurring theme in past developer feedback. Consider using parallel builds and caching strategies to speed up the process.",
                    action: "IDEATION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Brainstorm ways to improve the testing strategy for user5/repo5",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Considering the current testing framework and previous feedback, here are some suggestions:\n\n1. **Expand Unit Testing**: Increase the coverage of unit tests, especially for critical modules, to catch bugs early in the development cycle.\n2. **Integrate End-to-End Testing**: Implement end-to-end tests using tools like Cypress to ensure the application works as expected from the user's perspective.\n3. **Adopt Test-Driven Development (TDD)**: Encourage the practice of writing tests before code to improve code quality and design.\n4. **Use Mocking Libraries**: Utilize mocking libraries to simulate complex dependencies and isolate tests for more reliable results.\n5. **Automate Regression Testing**: Set up automated regression tests to quickly identify any new bugs introduced by recent changes.",
                    action: "IDEATION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Provide suggestions for enhancing the user experience in user6/repo6",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Based on user feedback and current design trends, here are some suggestions to enhance user experience:\n\n1. **Simplify Navigation**: Streamline the navigation structure to make it more intuitive and user-friendly.\n2. **Improve Load Times**: Optimize assets and implement lazy loading to improve page load times, enhancing the overall user experience.\n3. **Enhance Visual Design**: Update the visual design to align with modern aesthetics, using consistent color schemes and typography.\n4. **Increase Interactivity**: Add interactive elements such as animations and transitions to make the application more engaging.\n5. **Conduct User Testing**: Regularly conduct user testing sessions to gather feedback and make informed design decisions.",
                    action: "IDEATION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Share thoughts on improving the code quality of user7/repo7",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here are some thoughts on improving code quality, considering past code reviews and current standards:\n\n1. **Adopt Coding Standards**: Implement consistent coding standards across the project to improve readability and maintainability.\n2. **Conduct Regular Code Reviews**: Establish a process for regular code reviews to catch issues early and share knowledge among team members.\n3. **Refactor Complex Code**: Identify and refactor complex code sections to simplify logic and improve clarity.\n4. **Implement Static Code Analysis**: Use tools like ESLint or SonarQube to automatically detect code smells and enforce best practices.\n5. **Encourage Pair Programming**: Promote pair programming sessions to facilitate knowledge sharing and improve code quality through collaboration.",
                    action: "IDEATION",
                },
            },
        ],
    ],
};

export const githubIdeationPlugin: Plugin = {
    name: "githubIdeation",
    description: "Integration with GitHub for ideation and co-creation",
    actions: [ideationAction],
};
