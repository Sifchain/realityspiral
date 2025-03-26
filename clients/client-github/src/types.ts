import { elizaLogger } from "@elizaos/core";
import { githubReactions } from "@realityspiral/plugin-github";
import { captureError } from "@realityspiral/sentry";
import { z } from "zod";

export const ConfigGithubInfoSchema = z.object({
	owner: z.string().min(1, "GitHub owner is required"),
	repo: z.string().min(1, "GitHub repo is required"),
	branch: z.string().min(1, "GitHub branch is required"),
});

export interface ConfigGithubInfoContent {
	owner: string;
	repo: string;
	branch: string;
}

export const isConfigGithubInfoContent = (
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	object: any,
): object is ConfigGithubInfoContent => {
	if (ConfigGithubInfoSchema.safeParse(object).success) {
		return true;
	}
	const errorMessage = "Invalid content";
	elizaLogger.error(`${errorMessage}: ${object}`);
	captureError(new Error(errorMessage), {
		action: "isConfigGithubInfoContent",
		object,
	});
	return false;
};

export const StopSchema = z.object({
	action: z.literal("STOP"),
});

export type StopContent = {
	action: "STOP";
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isStopContent = (object: any): object is StopContent => {
	if (StopSchema.safeParse(object).success) {
		return true;
	}
	const errorMessage = "Invalid content";
	elizaLogger.error(`${errorMessage}: ${object}`);
	captureError(new Error(errorMessage), {
		action: "isStopContent",
		object,
	});
	return false;
};

export const OODASchema = z.object({
	action: z.enum([
		"CREATE_ISSUE",
		"CREATE_PULL_REQUEST",
		"COMMENT_ON_PULL_REQUEST",
		"COMMENT_ON_ISSUE",
		"REACT_TO_ISSUE",
		"REACT_TO_PR",
		"REPLY_TO_PR_COMMENT",
		"IMPLEMENT_FEATURE",
		"CLOSE_ISSUE",
		"CLOSE_PULL_REQUEST",
		"MERGE_PULL_REQUEST",
		"NOTHING",
		"STOP",
	]),
	owner: z.string().nullable().optional(),
	repo: z.string().nullable().optional(),
	path: z.string().nullable().optional(),
	branch: z.string().nullable().optional(),
	title: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	files: z
		.array(z.object({ path: z.string(), content: z.string() }))
		.nullable()
		.optional(),
	message: z.string().nullable().optional(),
	labels: z.array(z.string()).nullable().optional(),
	issue: z.number().nullable().optional(),
	reasoning: z.string().nullable().optional(),
	reaction: z
		.enum(githubReactions as [string, ...string[]])
		.nullable()
		.optional(),
});

export interface OODAContent {
	action: string;
	owner?: string;
	repo?: string;
	path?: string;
	branch?: string;
	title?: string;
	description?: string;
	files: { path: string; content: string }[];
	message?: string;
	labels?: string[];
	issue?: number;
	reasoning: string;
	reaction?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isOODAContent = (object: any): object is OODAContent => {
	return OODASchema.safeParse(object).success;
};
