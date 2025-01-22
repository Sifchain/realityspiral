import { Provider } from "@elizaos/core";
import { fetchFiles } from "../utils/githubProviderUtil";

export const documentationFilesProvider: Provider = {
    get: async (runtime, message, state) => {
        return fetchFiles(
            runtime,
            message,
            state,
            "documentation files",
            (githubService) => githubService.getDocumentation()
        );
    },
};
