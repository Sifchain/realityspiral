import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const githubEnvSchema = z.object({
    GITHUB_API_TOKEN: z.string().min(1, "GitHub API token is required"),
});

export type GithubConfig = z.infer<typeof githubEnvSchema>;

export async function validateGithubConfig(
    runtime: IAgentRuntime
): Promise<GithubConfig> {
    try {
        const config = {
            GITHUB_API_TOKEN: runtime.getSetting("GITHUB_API_TOKEN"),
        };

        return githubEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `GitHub configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
