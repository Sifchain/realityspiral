import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { graphql, GraphqlResponseError } from "@octokit/graphql";
import type { GraphQlQueryResponseData } from "@octokit/graphql";
import { elizaLogger } from "@elizaos/core";
import { GithubReaction } from "../types";

interface GitHubConfig {
    owner: string;
    repo: string;
    auth: string;
    branch?: string;
}

export class GitHubService {
    private octokit: Octokit;
    private config: GitHubConfig;
    private graphqlClient: typeof graphql;

    constructor(config: GitHubConfig) {
        this.config = config;
        this.octokit = new Octokit({ auth: config.auth });
        this.graphqlClient = graphql.defaults({
            headers: { authorization: `token ${config.auth}` },
        });
    }

    // Scenario 1 & 2: Get file contents for code analysis
    async getFileContents(path: string): Promise<string> {
        try {
            const response = await this.octokit.repos.getContent({
                owner: this.config.owner,
                repo: this.config.repo,
                branch: this.config.branch,
                path,
            });

            // GitHub API returns content as base64
            if ("content" in response.data && !Array.isArray(response.data)) {
                return Buffer.from(response.data.content, "base64").toString();
            }
            throw new Error("Unable to get file contents");
        } catch (error) {
            elizaLogger.error(`Error getting file contents: ${error}`);
            throw error;
        }
    }

    // Scenario 3: Get test files
    async getTestFiles(testPath: string): Promise<string[]> {
        try {
            const response = await this.octokit.repos.getContent({
                owner: this.config.owner,
                repo: this.config.repo,
                branch: this.config.branch,
                path: testPath,
            });

            if (Array.isArray(response.data)) {
                return response.data
                    .filter(
                        (file) =>
                            file.type === "file" && file.name.includes("test")
                    )
                    .map((file) => file.path);
            }
            return [];
        } catch (error) {
            elizaLogger.error(`Error getting test files: ${error}`);
            throw error;
        }
    }

    // Scenario 4: Get workflow files
    async getWorkflows(): Promise<
        RestEndpointMethodTypes["actions"]["listRepoWorkflows"]["response"]["data"]["workflows"]
    > {
        try {
            const response = await this.octokit.actions.listRepoWorkflows({
                owner: this.config.owner,
                repo: this.config.repo,
                branch: this.config.branch,
            });

            return response.data.workflows;
        } catch (error) {
            elizaLogger.error(`Error getting workflows: ${error}`);
            throw error;
        }
    }

    // Scenario 5: Get documentation files
    async getDocumentation(docPath: string = ""): Promise<string[]> {
        try {
            const response = await this.octokit.repos.getContent({
                owner: this.config.owner,
                repo: this.config.repo,
                path: docPath,
                branch: this.config.branch,
            });

            if (Array.isArray(response.data)) {
                return response.data
                    .filter(
                        (file) =>
                            file.type === "file" &&
                            (file.name.toLowerCase().includes("readme") ||
                                file.name.toLowerCase().includes("docs") ||
                                file.path.includes(".md"))
                    )
                    .map((file) => file.path);
            }
            return [];
        } catch (error) {
            elizaLogger.error(`Error getting documentation: ${error}`);
            throw error;
        }
    }

    // Scenario 7: Get source files for refactoring analysis
    async getSourceFiles(sourcePath: string): Promise<string[]> {
        try {
            const response = await this.octokit.repos.getContent({
                owner: this.config.owner,
                repo: this.config.repo,
                path: sourcePath,
                branch: this.config.branch,
            });

            if (Array.isArray(response.data)) {
                return response.data
                    .filter(
                        (file) =>
                            file.type === "file" &&
                            !file.name.toLowerCase().includes("test")
                    )
                    .map((file) => file.path);
            }
            return [];
        } catch (error) {
            elizaLogger.error(`Error getting source files: ${error}`);
            throw error;
        }
    }

    // Create a new issue
    async createIssue(
        title: string,
        body: string,
        labels?: string[]
    ): Promise<
        RestEndpointMethodTypes["issues"]["create"]["response"]["data"]
    > {
        try {
            const response = await this.octokit.issues.create({
                owner: this.config.owner,
                repo: this.config.repo,
                title,
                body,
                labels: [...(labels || []), "agent-generated"],
                branch: this.config.branch,
            });

            return response.data;
        } catch (error) {
            elizaLogger.error(`Error creating issue: ${error}`);
            throw error;
        }
    }

    // Update an existing issue and open or close it
    async updateIssue(
        issueNumber: number,
        updates: {
            title?: string;
            body?: string;
            state?: "open" | "closed";
            labels?: string[];
        }
    ): Promise<
        RestEndpointMethodTypes["issues"]["update"]["response"]["data"]
    > {
        try {
            const response = await this.octokit.issues.update({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                ...updates,
                branch: this.config.branch,
            });

            return response.data;
        } catch (error) {
            elizaLogger.error(`Error updating issue: ${error}`);
            throw error;
        }
    }

    // Add a comment to an issue
    async addIssueComment(
        issueNumber: number,
        body: string,
        emojiReaction?: GithubReaction
    ): Promise<
        RestEndpointMethodTypes["issues"]["createComment"]["response"]["data"]
    > {
        let response;
        try {
            response = await this.octokit.issues.createComment({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                body,
                branch: this.config.branch,
            });
        } catch (error) {
            elizaLogger.error(`Error adding comment to issue: ${error}`);
            throw error;
        }
        try {
            await this.createReactionForIssueComment(
                this.config.owner,
                this.config.repo,
                issueNumber,
                response.data.id,
                "eyes"
            );
        } catch (error) {
            elizaLogger.error("Failed to add label to issue:", error);
        }
        try {
            if (emojiReaction) {
                await this.createReactionForIssueComment(
                    this.config.owner,
                    this.config.repo,
                    issueNumber,
                    response.data.id,
                    emojiReaction
                );
            }
        } catch (error) {
            elizaLogger.error(`Error adding comment to issue: ${error}`);
            throw error;
        }
        return response.data;
    }

    // Get issue details
    async getIssue(
        issueNumber: number
    ): Promise<RestEndpointMethodTypes["issues"]["get"]["response"]["data"]> {
        try {
            const response = await this.octokit.issues.get({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                branch: this.config.branch,
            });

            return response.data;
        } catch (error) {
            elizaLogger.error(`Error getting issue details: ${error}`);
            throw error;
        }
    }

    // Get all issues
    async getIssues(
        per_page: number = 999999
    ): Promise<RestEndpointMethodTypes["issues"]["list"]["response"]["data"]> {
        const response = await this.octokit.issues.listForRepo({
            owner: this.config.owner,
            repo: this.config.repo,
            branch: this.config.branch,
            per_page: per_page,
        });
        return response.data;
    }

    // Get all pull requests
    async getPullRequests(
        per_page: number = 999999
    ): Promise<RestEndpointMethodTypes["pulls"]["list"]["response"]["data"]> {
        const response = await this.octokit.pulls.list({
            owner: this.config.owner,
            repo: this.config.repo,
            branch: this.config.branch,
            per_page: per_page,
        });
        return response.data;
    }

    // Get open pull requests
    async getPullRequestsByState(
        state: "open" | "closed" | "all" = "open",
        per_page: number = 999999
    ): Promise<RestEndpointMethodTypes["pulls"]["list"]["response"]["data"]> {
        const response = await this.octokit.pulls.list({
            owner: this.config.owner,
            repo: this.config.repo,
            state,
            per_page: per_page,
        });
        return response.data;
    }

    // Get a specific pull request
    async getPullRequest(
        pullRequestNumber: number
    ): Promise<RestEndpointMethodTypes["pulls"]["get"]["response"]["data"]> {
        const response = await this.octokit.pulls.get({
            owner: this.config.owner,
            repo: this.config.repo,
            pull_number: pullRequestNumber,
        });
        return response.data;
    }

    async addPRCommentAndReview(
        pullRequestNumber: number,
        comment: string,
        lineLevelComments: {
            /** @description The relative path to the file that necessitates a review comment. */
            path: string;
            /** @description The position in the diff where you want to add a review comment. Note this value is not the same as the line number in the file. The `position` value equals the number of lines down from the first "@@" hunk header in the file you want to add a comment. The line just below the "@@" line is position 1, the next line is position 2, and so on. The position in the diff continues to increase through lines of whitespace and additional hunks until the beginning of a new file. */
            position?: number;
            /** @description Text of the review comment. */
            body: string;
            /** @example 28 */
            line?: number;
            /** @example RIGHT */
            side?: string;
            /** @example 26 */
            start_line?: number;
            /** @example LEFT */
            start_side?: string;
        }[] = [],
        action: "COMMENT" | "APPROVE" | "REQUEST_CHANGES" = "COMMENT"
    ): Promise<
        RestEndpointMethodTypes["pulls"]["createReview"]["response"]["data"]
    > {
        const pullRequest = await this.getPullRequest(pullRequestNumber);
        try {
            const response = await this.octokit.pulls.createReview({
                owner: this.config.owner,
                repo: this.config.repo,
                pull_number: pullRequestNumber,
                body: comment,
                event: action,
                branch: this.config.branch,
                comments: lineLevelComments,
                commit_id: pullRequest.head.sha,
            });

            try {
                // Add labels to the pull request
                const labels = ["agent-commented"];
                if (action !== "COMMENT") {
                    labels.push("agent-reviewed");
                }
                await this.addLabelsToLabelable(pullRequest.node_id, labels);
            } catch (labelError) {
                elizaLogger.error(
                    "Failed to add labels to pull request:",
                    labelError
                );
            }

            return response.data;
        } catch (error) {
            elizaLogger.error("Failed to add comment to pull request:", error);
            throw error;
        }
    }

    async replyToPRComment(
        pullRequestNumber: number,
        commentId: number,
        body: string,
        emojiReaction: GithubReaction
    ): Promise<
        RestEndpointMethodTypes["pulls"]["createReplyForReviewComment"]["response"]["data"]
    > {
        let response;
        try {
            response = await this.octokit.pulls.createReplyForReviewComment({
                owner: this.config.owner,
                repo: this.config.repo,
                pull_number: pullRequestNumber,
                comment_id: commentId,
                body,
            });
        } catch (error) {
            elizaLogger.error(
                "Failed to reply to pull request comment:",
                error
            );
        }
        try {
            // react to the comment with the emoji reaction
            await this.createReactionForPullRequestReviewComment(
                this.config.owner,
                this.config.repo,
                commentId,
                emojiReaction
            );
            return response.data;
        } catch (error) {
            elizaLogger.error(
                "Failed to react to pull request comment:",
                error
            );
            throw error;
        }
    }

    async addLabelsToIssue(
        issueNumber: number,
        labels: string[]
    ): Promise<
        RestEndpointMethodTypes["issues"]["addLabels"]["response"]["data"]
    > {
        const response = await this.octokit.issues.addLabels({
            owner: this.config.owner,
            repo: this.config.repo,
            issue_number: issueNumber,
            labels: labels,
        });
        return response.data;
    }

    public async mergePullRequest(
        owner: string,
        repo: string,
        pullNumber: number,
        mergeMethod: "merge" | "squash" | "rebase" = "merge"
    ): Promise<RestEndpointMethodTypes["pulls"]["merge"]["response"]["data"]> {
        try {
            // Check if the pull request is mergeable
            const prResponse = await this.octokit.pulls.get({
                owner,
                repo,
                pull_number: pullNumber,
            });

            if (prResponse.data.mergeable) {
                let response;
                try {
                    response = await this.octokit.pulls.merge({
                        owner,
                        repo,
                        pull_number: pullNumber,
                        merge_method: mergeMethod,
                    });
                } catch (error) {
                    elizaLogger.error("Failed to merge pull request:", error);
                    throw error;
                }

                try {
                    // add agent-merged label
                    await this.addLabelsToIssue(pullNumber, ["agent-merged"]);
                } catch (error) {
                    elizaLogger.error(
                        "Failed to add label to pull request:",
                        error
                    );
                    throw error;
                }
                return response.data;
            } else {
                // update the branch if it isn't mergable
                try {
                    await this.octokit.pulls.updateBranch({
                        owner: this.config.owner,
                        repo: this.config.repo,
                        pull_number: pullNumber,
                    });
                } catch (error) {
                    elizaLogger.error("Failed to update branch:", error);
                }
                elizaLogger.error("Pull request is not mergeable");
                throw new Error("Pull request is not mergeable");
            }
        } catch (error) {
            elizaLogger.error("Failed to merge pull request:", error);
            throw error;
        }
    }

    public async updatePullRequest(
        owner: string,
        repo: string,
        pullNumber: number,
        title?: string,
        body?: string,
        state?: "open" | "closed"
    ): Promise<RestEndpointMethodTypes["pulls"]["update"]["response"]["data"]> {
        const response = await this.octokit.pulls.update({
            owner,
            repo,
            pull_number: pullNumber,
            title,
            body,
            state,
        });
        return response.data;
    }
    /**
     * Fetch the diff from a PR.
     * @param url The PR url
     * @returns The diff text of the PR
     */
    public async getPRDiffText(url: string): Promise<string> {
        try {
            const diffResponse = await this.octokit.request({
                method: "GET",
                url,
                headers: {
                    accept: "application/vnd.github.v3.diff",
                },
                branch: this.config.branch,
            });

            // Split the diff into sections by file (diff sections start with "diff --git")
            const diffSections = (diffResponse.data as string).split(
                "diff --git"
            );

            // Process each section
            const truncatedSections = diffSections.map((section) => {
                if (!section.trim()) return "";

                // Add back the "diff --git" prefix except for first empty section
                const processedSection = "diff --git" + section;

                // If section is longer than 1000 chars, truncate and add indicator
                if (processedSection.length > 1000) {
                    return (
                        processedSection.substring(0, 1000) +
                        "\n...[diff truncated]..."
                    );
                }
                return processedSection;
            });

            return truncatedSections.join("\n");
        } catch (error) {
            elizaLogger.error("Error fetching diff:", error);
            throw error;
        }
    }

    /**
     * Fetch the comments from a PR.
     * @param comments_url The PR comments url
     * @returns The comments text of the PR
     */
    public async getPRCommentsText(commentsUrl: string): Promise<string> {
        try {
            const commentsResponse = await this.octokit.request({
                method: "GET",
                url: commentsUrl,
                headers: {
                    accept: "application/vnd.github.v3+json",
                },
                branch: this.config.branch,
            });

            return JSON.stringify(commentsResponse.data);
        } catch (error) {
            elizaLogger.error("Error fetching comments:", error);
            throw error;
        }
    }

    /**
     * Fetch the comments from an issue.
     * @param comments_url The issue comments url
     * @returns The comments text of the issue
     */
    public async getIssueCommentsText(
        commentsUrl: string
    ): Promise<
        RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"]
    > {
        try {
            const commentsResponse = await this.octokit.request({
                method: "GET",
                url: commentsUrl,
                headers: {
                    accept: "application/vnd.github.v3+json",
                },
                branch: this.config.branch,
            });

            return commentsResponse.data;
        } catch (error) {
            elizaLogger.error("Error fetching comments:", error);
            throw error;
        }
    }

    /**
     * Create a reaction for a commit comment.
     * @param owner The repository owner
     * @param repo The repository name
     * @param commentId The comment ID
     * @param reaction The reaction type
     * @returns The created reaction
     */
    public async createReactionForCommitComment(
        owner: string,
        repo: string,
        commentId: number,
        reaction: GithubReaction
    ): Promise<
        RestEndpointMethodTypes["reactions"]["createForCommitComment"]["response"]["data"]
    > {
        try {
            const response =
                await this.octokit.reactions.createForCommitComment({
                    owner,
                    repo,
                    comment_id: commentId,
                    content: reaction,
                });

            return response.data;
        } catch (error) {
            elizaLogger.error(
                "Error creating reaction for commit comment:",
                error
            );
            throw error;
        }
    }

    /**
     * Create a reaction for an issue.
     * @param owner The repository owner
     * @param repo The repository name
     * @param issueNumber The issue number
     * @param reaction The reaction type
     * @returns The created reaction
     */
    public async createReactionForIssue(
        owner: string,
        repo: string,
        issueNumber: number,
        reaction:
            | "+1"
            | "-1"
            | "laugh"
            | "confused"
            | "heart"
            | "hooray"
            | "rocket"
            | "eyes"
    ): Promise<
        RestEndpointMethodTypes["reactions"]["createForIssue"]["response"]["data"]
    > {
        try {
            const response = await this.octokit.reactions.createForIssue({
                owner,
                repo,
                issue_number: issueNumber,
                content: reaction,
            });
            // add agent-interacted label
            await this.addLabelsToIssue(issueNumber, ["agent-interacted"]);

            return response.data;
        } catch (error) {
            elizaLogger.error("Error creating reaction for issue:", error);
            throw error;
        }
    }

    /**
     * Create a reaction for an issue comment.
     * @param owner The repository owner
     * @param repo The repository name
     * @param commentId The comment ID
     * @param reaction The reaction type
     * @returns The created reaction
     */
    public async createReactionForIssueComment(
        owner: string,
        repo: string,
        issueNumber: number,
        commentId: number,
        reaction: GithubReaction
    ): Promise<
        RestEndpointMethodTypes["reactions"]["createForIssueComment"]["response"]["data"]
    > {
        try {
            const response = await this.octokit.reactions.createForIssueComment(
                {
                    owner,
                    repo,
                    comment_id: commentId,
                    content: reaction,
                }
            );

            // add agent-interacted label
            await this.addLabelsToIssue(issueNumber, ["agent-interacted"]);
            return response.data;
        } catch (error) {
            elizaLogger.error(
                "Error creating reaction for issue comment:",
                error
            );
            throw error;
        }
    }

    /**
     * Create a reaction for a pull request review comment.
     * @param owner The repository owner
     * @param repo The repository name
     * @param commentId The comment ID
     * @param reaction The reaction type
     * @returns The created reaction
     */
    public async createReactionForPullRequestReviewComment(
        owner: string,
        repo: string,
        commentId: number,
        reaction: GithubReaction
    ): Promise<
        RestEndpointMethodTypes["reactions"]["createForPullRequestReviewComment"]["response"]["data"]
    > {
        try {
            const response =
                await this.octokit.reactions.createForPullRequestReviewComment({
                    owner,
                    repo,
                    comment_id: commentId,
                    content: reaction,
                });

            return response.data;
        } catch (error) {
            elizaLogger.error(
                "Error creating reaction for pull request review comment:",
                error
            );
            throw error;
        }
    }

    // TODO: This is a temporary fix to get the position of the line in the diff. We need to find a better way to do this.
    /**
     * Parses the diff and determines the position of a specific line in a file.
     * @param diff - The diff text of the pull request.
     * @param filePath - The path to the file in the repository.
     * @param lineNumber - The line number in the file to comment on.
     * @returns The position in the diff where the comment should be added, or undefined if not found.
     */
    public getPositionFromDiff(
        diff: string,
        filePath: string,
        lineNumber: number
    ): number | undefined {
        const diffLines = diff.split("\n");
        let currentFile = "";
        let position = 0;
        let withinHunk = false;
        let currentLineInFile = 0;
        let lineNum = lineNumber + 3;
        for (let i = 0; i < diffLines.length; i++) {
            const line = diffLines[i];

            // Detect file header
            if (line.startsWith("diff --git")) {
                const match = line.match(/a\/(.+) b\/(.+)/);
                if (match) {
                    currentFile = match[2];
                }
                withinHunk = false;
                currentLineInFile = 0;
                continue;
            }

            // Only process the specified file
            if (currentFile !== filePath) {
                continue;
            }

            // Detect hunk header
            if (line.startsWith("@@")) {
                withinHunk = true;
                const hunkMatch = line.match(
                    /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/
                );
                if (hunkMatch) {
                    currentLineInFile = parseInt(hunkMatch[1], 10) - 1;
                }
                continue;
            }

            if (withinHunk) {
                // Lines in the diff
                if (
                    line.startsWith("+") ||
                    line.startsWith("-") ||
                    line.startsWith(" ") ||
                    line.startsWith("\\")
                ) {
                    position += 1;
                    const prefix = line[0];
                    if (prefix === "+" || prefix === " ") {
                        currentLineInFile += 1;
                    }
                    // Check if this line is the target line
                    if (currentLineInFile === lineNum) {
                        return position;
                    }
                }
            }
        }

        // If position not found
        return undefined;
    }
    // Example usage within a method or class
    public async addLineLevelComment(
        diffText: string,
        filePath: string,
        lineNumber: number,
        commentBody: string
    ): Promise<{
        path: string;
        position?: number;
        body: string;
        line?: number;
        side?: string;
        start_line?: number;
        start_side?: string;
    }> {
        // Determine the position from the diff
        const position = this.getPositionFromDiff(
            diffText,
            filePath,
            lineNumber
        );

        if (position === undefined) {
            throw new Error(
                `Could not determine position for file ${filePath} at line ${lineNumber}`
            );
        }
        const comment: {
            path: string;
            position?: number;
            body: string;
            line?: number;
            side?: string;
            start_line?: number;
            start_side?: string;
        } = {
            path: filePath,
            body: commentBody,
            position: position,
        };
        return comment;
    }
    // TODO: test this
    // Add labels to a labelable (issue or pull request)
    async addLabelsToLabelable(
        labelableId: string,
        labels: string[]
    ): Promise<{ clientMutationId: string; labelable: any }> {
        const mutation = `
            mutation($input: AddLabelsToLabelableInput!) {
                addLabelsToLabelable(input: $input) {
                    clientMutationId
                    labelable {
                        labels(first: 10) {
                            nodes {
                                name
                            }
                        }
                    }
                }
            }
        `;
        elizaLogger.info(`Adding labels to labelable: ${labelableId}`);
        try {
            const labelIds = await this.fetchLabelIds(labels);
            elizaLogger.info(`Label IDs: ${labelIds}`);
            const variables = {
                input: {
                    labelableId,
                    labelIds,
                },
            };
            const response: GraphQlQueryResponseData = await this.graphqlClient(
                mutation,
                variables
            );
            elizaLogger.info(`Labels added to labelable: ${labelableId}`);
            elizaLogger.info(`Response: ${JSON.stringify(response)}`);
            return response.addLabelsToLabelable;
        } catch (error) {
            if (error instanceof GraphqlResponseError) {
                elizaLogger.error(`GraphQL error: ${error.message}`);
                elizaLogger.error(
                    `Request details: ${JSON.stringify(error.request)}`
                );
            } else {
                elizaLogger.error(`Error adding labels to labelable: ${error}`);
            }
            throw error;
        }
    }
    // Helper function to fetch label IDs by name
    async fetchLabelIds(labelNames: string[]): Promise<string[]> {
        const query = `
            query($owner: String!, $repo: String!) {
                repository(owner: $owner, name: $repo) {
                    labels(first: 100) {
                        nodes {
                            id
                            name
                        }
                    }
                }
            }
        `;

        try {
            const { repository }: GraphQlQueryResponseData =
                await this.graphqlClient(query, {
                    owner: this.config.owner,
                    repo: this.config.repo,
                });

            const labelMap = new Map(
                repository.labels.nodes.map(
                    (label: { id: string; name: string }) => [
                        label.name,
                        label.id,
                    ]
                )
            );
            return labelNames
                .map((name) => labelMap.get(name))
                .filter((id) => id !== undefined) as string[];
        } catch (error) {
            elizaLogger.error(`Error fetching label IDs: ${error}`);
            throw error;
        }
    }

    /**
     * Retrieves the latest commit SHA from a specified branch.
     * @param owner - The owner of the repository.
     * @param repo - The repository name.
     * @param branch - The branch name.
     * @returns The latest commit SHA.
     */
    private async getLatestCommitSha(
        owner: string,
        repo: string,
        branch: string
    ): Promise<string> {
        const { data: refData } = await this.octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        });
        return refData.object.sha;
    }

    /**
     * Retrieves the tree SHA from a given commit SHA.
     * @param owner - The owner of the repository.
     * @param repo - The repository name.
     * @param commitSha - The commit SHA.
     * @returns The tree SHA.
     */
    private async getTreeSha(
        owner: string,
        repo: string,
        commitSha: string
    ): Promise<string> {
        const { data: commitData } = await this.octokit.git.getCommit({
            owner,
            repo,
            commit_sha: commitSha,
        });
        return commitData.tree.sha;
    }

    /**
     * Creates a new tree with the specified file changes.
     * @param owner - The owner of the repository.
     * @param repo - The repository name.
     * @param baseTreeSha - The base tree SHA.
     * @param files - An array of file changes with their paths and contents.
     * @returns The new tree SHA.
     */
    private async createNewTree(
        owner: string,
        repo: string,
        baseTreeSha: string,
        files: { path: string; content: string }[]
    ): Promise<string> {
        const tree = files.map((file) => ({
            path: file.path,
            mode: "100644", // File mode for blob objects
            type: "blob",
            content: file.content,
        }));

        const { data: newTreeData } = await this.octokit.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: tree as {
                path?: string;
                mode?: "100644" | "100755" | "040000" | "160000" | "120000";
                type?: "blob" | "tree" | "commit";
                sha?: string;
                content?: string;
            }[],
        });

        return newTreeData.sha;
    }

    /**
     * Creates a new commit with the specified file changes.
     * @param owner - The owner of the repository.
     * @param repo - The repository name.
     * @param branch - The branch name.
     * @param message - The commit message.
     * @param files - An array of file changes with their paths and contents.
     * @returns The new commit SHA.
     */
    async createCommit(
        owner: string,
        repo: string,
        branch: string,
        message: string,
        files: { path: string; content: string }[]
    ): Promise<
        RestEndpointMethodTypes["git"]["createCommit"]["response"]["data"]
    > {
        try {
            // Step 1: Get the latest commit SHA from the branch
            const latestCommitSha = await this.getLatestCommitSha(
                owner,
                repo,
                branch
            );
            console.log(
                `Latest commit SHA on branch '${branch}': ${latestCommitSha}`
            );

            // Step 2: Get the tree SHA from the latest commit
            const baseTreeSha = await this.getTreeSha(
                owner,
                repo,
                latestCommitSha
            );
            console.log(`Base tree SHA: ${baseTreeSha}`);

            // Step 3: Create a new tree with the file changes
            const newTreeSha = await this.createNewTree(
                owner,
                repo,
                baseTreeSha,
                files
            );
            console.log(`New tree SHA: ${newTreeSha}`);

            // Step 4: Create a new commit
            const { data: newCommit } = await this.octokit.git.createCommit({
                owner,
                repo,
                message: message,
                tree: newTreeSha,
                parents: [latestCommitSha],
            });
            console.log(`New commit created with SHA: ${newCommit.sha}`);

            return newCommit;
        } catch (error) {
            console.error("Error creating commit:", error);
            throw error;
        }
    }

    /**
     * Updates the reference of the branch to point to the new commit.
     * @param owner - The owner of the repository.
     * @param repo - The repository name.
     * @param branch - The branch name.
     * @param newCommitSha - The new commit SHA.
     */
    async updateBranchReference(
        owner: string,
        repo: string,
        branch: string,
        newCommitSha: string
    ): Promise<void> {
        try {
            await this.octokit.git.updateRef({
                owner,
                repo,
                ref: `heads/${branch}`,
                sha: newCommitSha,
                force: false, // Set to true if you need to force update
            });
            console.log(
                `Branch '${branch}' updated to commit SHA: ${newCommitSha}`
            );
        } catch (error) {
            console.error("Error updating branch reference:", error);
            throw error;
        }
    }
}

export { GitHubConfig };
