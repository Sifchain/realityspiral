import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import { existsSync } from "fs";
import simpleGit, { CommitResult } from "simple-git";
import { Octokit } from "@octokit/rest";
import {
    elizaLogger,
    getEmbeddingZeroVector,
    IAgentRuntime,
    Memory,
    State,
    stringToUuid,
    UUID,
} from "@elizaos/core";
import { RestEndpointMethodTypes } from "@octokit/rest";
import { contextTemplate } from "./templates";
import { GitHubService } from "./services/github";

export function getRepoPath(owner: string, repo: string) {
    return path.join("/tmp", "elizaos-repos", owner, repo);
}

export async function createReposDirectory(owner: string) {
    const dirPath = path.join("/tmp", "elizaos-repos", owner);
    if (existsSync(dirPath)) {
        elizaLogger.info(`Repos directory already exists: ${dirPath}`);
        return;
    }
    try {
        // Create repos directory
        await fs.mkdir(dirPath, {
            recursive: true,
        });
    } catch (error) {
        elizaLogger.error("Error creating repos directory:", error);
        throw new Error(`Error creating repos directory: ${error}`);
    }
}

export async function initRepo(
    token: string,
    owner: string,
    repo: string,
    branch: string,
) {
    const repoPath = getRepoPath(owner, repo);
    await createReposDirectory(owner);
    await cloneOrPullRepository(token, owner, repo, repoPath, branch);
    await checkoutBranch(repoPath, branch);
}

export async function cloneOrPullRepository(
    token: string,
    owner: string,
    repo: string,
    repoPath: string,
    branch: string = "main",
) {
    try {
        elizaLogger.info(
            `Cloning or pulling repository ${owner}/${repo}... @ branch: ${branch}`,
        );
        elizaLogger.info(
            `URL: https://github.com/${owner}/${repo}.git @ branch: ${branch}`,
        );

        // Clone or pull repository
        if (!existsSync(repoPath)) {
            const git = simpleGit();
            await git.clone(
                `https://${token}@github.com/${owner}/${repo}.git`,
                repoPath,
                {
                    "--branch": branch,
                },
            );
        } else {
            const git = simpleGit(repoPath);
            await git.pull("origin", branch);
        }
    } catch (error) {
        elizaLogger.error(
            `Error cloning or pulling repository ${owner}/${repo}:`,
            error,
        );
        throw new Error(`Error cloning or pulling repository: ${error}`);
    }
}

export async function writeFiles(
    repoPath: string,
    files: Array<{ path: string; content: string }>
) {
    try {
        // check if the local repo exists
        if (!existsSync(repoPath)) {
            elizaLogger.error(
                `Repository ${repoPath} does not exist locally. Please initialize the repository first.`
            );
            throw new Error(
                `Repository ${repoPath} does not exist locally. Please initialize the repository first.`
            );
        }

        for (const file of files) {
            const filePath = path.join(repoPath, file.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, file.content);
        }
    } catch (error) {
        elizaLogger.error("Error writing files:", error);
        throw new Error(`Error writing files: ${error}`);
    }
}

export async function commitAndPushChanges(
    repoPath: string,
    message: string,
    branch?: string
): Promise<CommitResult> {
    try {
        const git = simpleGit(repoPath);
        await git.add(".");
        const commit = await git.commit(message);
        let pushResult;
        if (branch) {
            pushResult = await git.push("origin", branch);
        } else {
            pushResult = await git.push();
        }
        elizaLogger.info("Push result:", pushResult);
        return commit;
    } catch (error) {
        elizaLogger.error("Error committing and pushing changes:", error);
        throw new Error(`Error committing and pushing changes: ${error}`);
    }
}

export async function checkoutBranch(
    repoPath: string,
    branch?: string,
    create: boolean = false
) {
    if (!branch) {
        return;
    }

    elizaLogger.info(`Checking out branch ${branch} in repository ${repoPath}`);

    try {
        const git = simpleGit(repoPath);

        // Get the list of branches
        const branchList = await git.branch();

        // Check if the branch exists
        const branchExists = branchList.all.includes(branch);

        if (create) {
            if (branchExists) {
                elizaLogger.warn(
                    `Branch "${branch}" already exists. Checking out instead.`
                );
                await git.checkout(branch); // Checkout the existing branch
            } else {
                // Create a new branch
                await git.checkoutLocalBranch(branch);
            }
        } else {
            if (!branchExists) {
                throw new Error(`Branch "${branch}" does not exist.`);
            }
            // Checkout an existing branch
            await git.checkout(branch);
        }
    } catch (error) {
        elizaLogger.error("Error checking out branch:", error.message);
        throw new Error(`Error checking out branch: ${error.message}`);
    }
}

export async function createPullRequest(
    token: string,
    owner: string,
    repo: string,
    branch: string,
    title: string,
    description?: string,
    base?: string
): Promise<RestEndpointMethodTypes["pulls"]["create"]["response"]["data"]> {
    try {
        const octokit = new Octokit({
            auth: token,
        });

        const pr = await octokit.pulls.create({
            owner,
            repo,
            title,
            body: description || title,
            head: branch,
            base: base || "develop",
        });
        return pr.data;
    } catch (error) {
        elizaLogger.error("Error creating pull request:", error);
        throw new Error(`Error creating pull request: ${error}`);
    }
}

export async function retrieveFiles(repoPath: string, gitPath: string) {
    // Build the search path
    const searchPath = gitPath
        ? path.join(repoPath, gitPath, "**/*")
        : path.join(repoPath, "**/*");
    elizaLogger.info(`Repo path: ${repoPath}`);
    elizaLogger.info(`Search path: ${searchPath}`);
    // Exclude `.git` directory and test files
    const ignorePatterns = [
        "**/.git/**",
        "**/.gitignore",
        "**/.github/**",
        "**/.env",
        "**/.env.local",
        "**/.env.*.local",
        "**/.vscode/**",
        "**/.idea/**",
        "**/.idea_modules/**",
        "**/.code-workspace",
        "test/**/*",
        "tests/**/*",
        "**/test/**/*",
        "**/tests/**/*",
        "**/*.test.*",
        "**/*.spec.*",
        "**/.DS_Store",
        "LICENSE",
        "CONTRIBUTING.md",
        "CODE_OF_CONDUCT.md",
    ];

    // Check if a .gitignore file exists
    const gitignorePath = path.join(repoPath, ".gitignore");
    if (existsSync(gitignorePath)) {
        const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
        const gitignoreLines = gitignoreContent
            .split("\n")
            .map((line) => line.trim())
            .filter(
                (line) => line && !line.startsWith("#") && !line.startsWith("!")
            ) // Exclude comments and lines starting with '!'
            .map((line) => `**/${line}`); // Convert to glob patterns

        ignorePatterns.push(...gitignoreLines);
    }

    elizaLogger.info(`Ignore patterns:\n${ignorePatterns.join("\n")}`);

    const files = await glob(searchPath, {
        nodir: true,
        dot: true, // Include dotfiles
        ignore: ignorePatterns, // Exclude .git, test files and .gitignore patterns
    });

    elizaLogger.info(`Retrieved Files:\n${files.join("\n")}`);

    return files;
}

export const getFilesFromMemories = async (
    runtime: IAgentRuntime,
    message: Memory
) => {
    const allMemories = await runtime.messageManager.getMemories({
        roomId: message.roomId,
    });
    // elizaLogger.info("Memories:", memories);
    const memories = allMemories.filter(
        (memory) => (memory.content.metadata as any)?.path
    );
    return memories.map(
        (memory) => `File: ${(memory.content.metadata as any)?.path}
        Content: ${memory.content.text.replace(/\n/g, "\\n")}
        `
    );
};

export async function getIssuesFromMemories(
    runtime: IAgentRuntime,
    message: Memory
): Promise<Memory[]> {
    const memories = await runtime.messageManager.getMemories({
        roomId: message.roomId,
        count: 1000,
    });

    // Filter memories to only include those that are issues
    const issueMemories = memories.filter(
        (memory) => (memory.content.metadata as any)?.type === "issue"
    );
    return issueMemories;
}

export const getIssueFromMemories = async (
    runtime: IAgentRuntime,
    message: Memory,
    issueNumber: number
): Promise<Memory | null> => {
    const roomId = message.roomId;
    const memories = await runtime.messageManager.getMemories({
        roomId,
        count: 1000,
    });
    const issueId = stringToUuid(
        `${roomId}-${runtime.agentId}-issue-${issueNumber}`
    );
    return memories.find((memory) => memory.id === issueId) ?? null;
};

export const getPullRequestFromMemories = async (
    runtime: IAgentRuntime,
    message: Memory,
    pullRequestNumber: number
): Promise<Memory | null> => {
    const roomId = message.roomId;
    const memories = await runtime.messageManager.getMemories({
        roomId,
        count: 1000,
    });
    const prId = stringToUuid(
        `${roomId}-${runtime.agentId}-pr-${pullRequestNumber}`
    );
    return memories.find((memory) => memory.id === prId) ?? null;
};

export async function saveIssueToMemory(
    userId: UUID,
    runtime: IAgentRuntime,
    message: Memory,
    issue: RestEndpointMethodTypes["issues"]["create"]["response"]["data"],
    previousIssue: boolean = false,
): Promise<Memory> {
    const issueId = stringToUuid(
        `${message.roomId}-${runtime.agentId}-issue-${issue.number}`,
    );
    const issueMemory: Memory = {
        id: issueId,
        userId: userId,
        agentId: runtime.agentId,
        roomId: message.roomId,
        content: {
            text: previousIssue
                ? `Previously created issue: ${issue.title} ${issue.html_url}`
                : `Created issue: ${issue.title} ${issue.html_url}`,
            action: "CREATE_ISSUE",
            source: "github",
            metadata: {
                type: "issue",
                url: issue.html_url,
                number: issue.number,
                state: issue.state,
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                comments: issue.comments,
                labels: issue.labels.map((label: any) =>
                    typeof label === "string" ? label : label?.name,
                ),
                body: issue.body,
            },
        },
    };

    await runtime.messageManager.createMemory(issueMemory);

    return issueMemory;
}

export const saveIssuesToMemory = async (
    userId: UUID,
    runtime: IAgentRuntime,
    message: Memory,
    owner: string,
    repository: string,
    branch: string,
    apiToken: string,
    limit: number = 999999,
    previousIssue: boolean = false,
): Promise<Memory[]> => {
    const githubService = new GitHubService({
        owner: owner,
        repo: repository,
        branch: branch,
        auth: apiToken,
    });
    const issues = await githubService.getIssues(limit);
    elizaLogger.log(`Total issues found: ${issues.length}`);
    const issuesMemories: Memory[] = [];
    // create memories for each issue if they are not already in the memories
    for (const issue of issues) {
        // check if the issue is already in the memories by checking id in the memories

        // const issueMemory = memories.find(
        //     (memory) =>
        //         memory.id ===
        //         stringToUuid(
        //             `${roomId}-${runtime.agentId}-issue-${issue.number}`
        //         )
        // );
        // if (!issueMemory) {
        const newIssueMemory = await saveIssueToMemory(
            userId,
            runtime,
            message,
            issue,
            previousIssue,
        );

        issuesMemories.push(newIssueMemory);
        // } else {
        //     elizaLogger.log("Issue already in memories:", issueMemory);
        //     // update the issue memory
        // }
    }
    return issuesMemories;
};

export async function incorporateRepositoryState(
    state: State,
    runtime: IAgentRuntime,
    relevantMemories: Memory[],
) {
    state.messageExamples = JSON.stringify(
        runtime.character?.messageExamples,
        null,
        2,
    );
    state.system = runtime.character?.system;
    state.topics = JSON.stringify(runtime.character?.topics, null, 2);
    state.style = JSON.stringify(runtime.character?.style, null, 2);
    state.adjectives = JSON.stringify(runtime.character?.adjectives, null, 2);
    const sanitizedMemories = sanitizeMemories(relevantMemories);
    state.relevantMemories = JSON.stringify(sanitizedMemories, null, 2);

    // Doesn't exist in character or state but we want it in state
    // state.facts = JSON.stringify(
    //     sanitizeMemories(
    //         (await runtime.messageManager.getMemories({
    //             roomId: message.roomId,
    //         })).filter(
    //             (memory) =>
    //                 !["issue", "pull_request"].includes((memory.content.metadata as any)?.type)
    //         )
    //     ),
    //     null,
    //     2
    // );
    // TODO:
    // We need to actually save goals, knowledge,facts, we only save memories for now
    // We need to dynamically update the goals, knoweldge, facts, bio, lore, we should add actions to update these and chain them to the OODA cycle

    return state;
}

export async function getPullRequestsFromMemories(
    runtime: IAgentRuntime,
    message: Memory,
): Promise<Memory[]> {
    const memories = await runtime.messageManager.getMemories({
        roomId: message.roomId,
        count: 1000,
    });
    // Filter memories to only include those that are pull requests
    const prMemories = memories.filter(
        (memory) => (memory.content.metadata as any)?.type === "pull_request",
    );
    return prMemories;
}

function sanitizeMemories(memories: Memory[]): Partial<Memory>[] {
    return memories.map((memory) => ({
        content: memory.content,
        roomId: memory.roomId,
        createdAt: memory.createdAt,
        // we could remove these for if hitting token limit
        userId: memory.userId,
        agentId: memory.agentId,
        similarity: memory.similarity,
    }));
}

export const createTemplate = (
    prompt: string,
    output: string,
    examples: string,
) => {
    return `
${prompt}

${contextTemplate}

${output}

${examples}
`;
};

export async function savePullRequestToMemory(
    userId: UUID,
    runtime: IAgentRuntime,
    message: Memory,
    pullRequest: RestEndpointMethodTypes["pulls"]["list"]["response"]["data"][number],
    owner: string,
    repo: string,
    branch: string,
    apiToken: string,
    previousPullRequest: boolean = false,
): Promise<Memory> {
    const githubService = new GitHubService({
        owner,
        repo,
        auth: apiToken,
    });
    const prId = stringToUuid(
        `${message.roomId}-${runtime.agentId}-pr-${pullRequest.number}`,
    );
    const prMemory: Memory = {
        id: prId,
        userId: userId,
        agentId: runtime.agentId,
        roomId: message.roomId,
        content: {
            text: previousPullRequest
                ? `Previously created pull request: ${pullRequest.title} ${pullRequest.html_url}`
                : `Created pull request: ${pullRequest.title} ${pullRequest.html_url}`,
            metadata: await getPullRequestMetadata(pullRequest, githubService),
        },
    };

    await runtime.messageManager.createMemory(prMemory);
    return prMemory;
}

export async function saveCreatedPullRequestToMemory(
    runtime: IAgentRuntime,
    message: Memory,
    pullRequest: RestEndpointMethodTypes["pulls"]["create"]["response"]["data"],
    owner: string,
    repository: string,
    branch: string,
    apiToken: string,
): Promise<Memory> {
    const githubService = new GitHubService({
        owner: owner,
        repo: repository,
        auth: apiToken,
    });
    const prId = stringToUuid(
        `${message.roomId}-${runtime.agentId}-pr-${pullRequest.number}`,
    );
    const prMemory: Memory = {
        id: prId,
        userId: runtime.agentId,
        agentId: runtime.agentId,
        roomId: message.roomId,
        content: {
            text: `Pull Request Created: ${pullRequest.title} (${pullRequest.html_url})`,
            action: "CREATE_PULL_REQUEST",
            metadata: await getCreatedPullRequestMetadata(
                pullRequest,
                githubService,
            ),
        },
    };

    await runtime.messageManager.createMemory(prMemory);
    return prMemory;
}

export const savePullRequestsToMemory = async (
    userId: UUID,
    runtime: IAgentRuntime,
    message: Memory,
    owner: string,
    repository: string,
    branch: string,
    apiToken: string,
    limit: number = 999999,
    previousPullRequest: boolean = false,
): Promise<Memory[]> => {
    const memories = await runtime.messageManager.getMemories({
        roomId: message.roomId,
    });
    const githubService = new GitHubService({
        owner: owner,
        repo: repository,
        auth: apiToken,
    });
    const pullRequests = await githubService.getPullRequests(limit);
    const pullRequestsMemories: Memory[] = [];
    // create memories for each pull request if they are not already in the memories
    for (const pr of pullRequests) {
        // check if the pull request is already in the memories by checking id in the memories
        const prMemory =
            memories.find(
                (memory) =>
                    memory.id ===
                    stringToUuid(
                        `${message.roomId}-${runtime.agentId}-pr-${pr.number}`,
                    ),
            ) ?? null;
        if (!prMemory) {
            const newPrMemory = await savePullRequestToMemory(
                userId,
                runtime,
                message,
                pr,
                owner,
                repository,
                branch,
                apiToken,
                previousPullRequest,
            );
            pullRequestsMemories.push(newPrMemory);
        } else {
            elizaLogger.log("Pull request already in memories:", prMemory);
        }
    }

    return pullRequestsMemories;
};

export async function getPullRequestMetadata(
    pullRequest: RestEndpointMethodTypes["pulls"]["list"]["response"]["data"][number],
    githubService: GitHubService
): Promise<any> {
    return {
        type: "pull_request",
        url: pullRequest.html_url,
        number: pullRequest.number,
        state: pullRequest.state,
        created_at: pullRequest.created_at,
        updated_at: pullRequest.updated_at,
        comments: await githubService.getPRCommentsText(
            pullRequest.comments_url
        ),
        labels: pullRequest.labels.map((label: any) =>
            typeof label === "string" ? label : label?.name
        ),
        body: pullRequest.body,
        diff: await githubService.getPRDiffText(pullRequest.url),
    };
}

export async function getCreatedPullRequestMetadata(
    pullRequest: RestEndpointMethodTypes["pulls"]["create"]["response"]["data"],
    githubService: GitHubService
): Promise<any> {
    return {
        type: "pull_request",
        url: pullRequest.html_url,
        number: pullRequest.number,
        state: pullRequest.state,
        created_at: pullRequest.created_at,
        updated_at: pullRequest.updated_at,
        comments: await githubService.getPRCommentsText(
            pullRequest.comments_url
        ),
        labels: pullRequest.labels.map((label: any) =>
            typeof label === "string" ? label : label?.name
        ),
        body: pullRequest.body,
        diff: await githubService.getPRDiffText(pullRequest.diff_url),
    };
}
