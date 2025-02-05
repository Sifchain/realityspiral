import { Provider } from "@elizaos/core";
import { fetchFiles } from "../utils/githubProviderUtil";
import { GitHubService } from "../services/github";

export const releasesProvider: Provider = {
    get: async (runtime, message, state) => {
        return fetchFiles(
            runtime,
            message,
            state,
            "releases",
            (githubService) => null,
            (release) => release,
            async (githubService, path) => path
        );
    },
};
