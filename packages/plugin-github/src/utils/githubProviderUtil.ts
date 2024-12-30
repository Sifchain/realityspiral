import {
    composeContext,
    generateObject,
    elizaLogger,
    IAgentRuntime,
    Memory,
    State,
    ModelClass,
} from "@elizaos/core";
import { GitHubService } from "../services/github";
import {
    FetchFilesContent,
    FetchFilesSchema,
    isFetchFilesContent,
} from "../types";
import { fetchFilesTemplate } from "../templates";

export async function fetchFiles(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    description: string,
    fetchFunction: (githubService: GitHubService) => Promise<any[]>,
    formatPath: (path: any) => string = (path) => path,
    getContentFunction: (
        githubService: GitHubService,
        item: any
    ) => Promise<any> = (service, item) => service.getFileContents(item)
) {
    try {
        elizaLogger.log("[fetchFiles] Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: fetchFilesTemplate,
        });

        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
            schema: FetchFilesSchema,
        });

        if (!isFetchFilesContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as FetchFilesContent;

        const owner = content.owner;
        const repo = content.repo;
        const branch = content.branch;

        elizaLogger.info(
            `Fetching ${description} from GitHub ${owner}/${repo} on branch ${branch}`
        );

        if (!owner || !repo || !branch) {
            elizaLogger.warn(
                `Missing repository details in state for ${description}`
            );
            return { files: [], repository: null };
        }

        // Initialize GitHub service
        const githubService = new GitHubService({
            auth: runtime.getSetting("GITHUB_API_TOKEN"),
            owner,
            repo,
        });

        // Fetch file paths using the provided function
        const filePaths = await fetchFunction(githubService);

        // Get contents for each file
        const fileContents = await Promise.all(
            filePaths.map(async (path) => {
                path = formatPath(path);
                const content = await getContentFunction(githubService, path);
                return { path, content };
            })
        );

        elizaLogger.info(
            `Retrieved ${fileContents.length} files from ${owner}/${repo} for ${description}`
        );

        return {
            files: fileContents,
            repository: {
                owner,
                repo,
                branch,
            },
        };
        // TODO: 404 errors  ["⛔ Error getting file contents: HttpError: Not Found - https://docs.github.com/rest/repos/contents#get-repository-content"]
    } catch (error) {
        elizaLogger.error(`Error in fetchFiles for ${description}:`, error);
        return { files: [], repository: null };
    }
}
