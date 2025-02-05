import { Provider } from "@elizaos/core";
import { fetchFiles } from "../utils/githubProviderUtil";

export const workflowFilesProvider: Provider = {
    get: async (runtime, message, state) => {
        return fetchFiles(
            runtime,
            message,
            state,
            "workflow files",
            (githubService) => githubService.getWorkflows(),
            (workflow) => workflow.path
        );
    },
};
