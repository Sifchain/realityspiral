import type { Provider } from "@elizaos/core";
import { fetchFiles } from "../utils/githubProviderUtil";

export const releasesProvider: Provider = {
	get: async (runtime, message, state) => {
		return fetchFiles(
			runtime,
			message,
			state,
			"releases",
			(_githubService) => null,
			(release) => release,
			async (_githubService, path) => path,
		);
	},
};
