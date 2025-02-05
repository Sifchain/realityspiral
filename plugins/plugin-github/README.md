# Github Plugin (`@eliza/plugin-github`)

This plugin integrates with the GitHub API to provide various actions and evaluators for managing repositories, issues, and pull requests.

**Actions:**

- `INITIALIZE_REPOSITORY` - Initialize a GitHub repository.
- `CREATE_COMMIT` - Create a new commit in a GitHub repository.
- `CREATE_PULL_REQUEST` - Create a new pull request in a GitHub repository.
- `MEMORIES_FROM_FILES` - Generate memories from files in a GitHub repository.

**Evaluators:**

None

**Providers:**

None

**Description:**

The GitHub plugins enable agents to interact with GitHub repositories, create commits, pull requests, and generate memories from files stored in a repository.

1. **Configure the Plugin**
   Add the plugin to your character’s configuration:

    ```typescript
    import {
        githubInitializeRepository,
        githubCreateCommit,
        githubCreatePullRequest,
        githubMemoriesFromFiles,
    } from "@eliza/plugin-github";

    const character = {
        plugins: [
            githubInitializeRepository,
            githubCreateCommit,
            githubCreatePullRequest,
            githubMemoriesFromFiles,
        ],
    };
    ```

2. **Ensure Secure Configuration**
   Set the following environment variables within the `.env` file. See next section to know how to create a new github api token.

    - `GITHUB_API_TOKEN`: API key for GitHub API access.

3. **Creating a GitHub Classic Token with `public_repo` Scope**

To generate a GitHub Classic token with the required `public_repo` scope, follow these steps:

- **\*Log in to GitHub**: Go to [GitHub](https://github.com/) and log in to your account.

- **Access Personal Access Tokens**:

    - Navigate to **Settings** by clicking on your profile picture in the top-right corner.
    - Under **Developer settings**, select **Personal access tokens** > **Tokens (classic)**.
    - Alternatively, you can go directly to [GitHub's token settings page](https://github.com/settings/tokens).

- **Generate New Token**:

    - Click on **Generate new token**.
    - Provide a note to identify the purpose of the token (e.g., "Plugin API Access").

- **Select the Scope**:

    - Under **Select scopes**, check the box for `public_repo`. This grants access to public repositories.

- **Generate and Save the Token**:

    - Scroll to the bottom and click **Generate token**.
    - **Important**: Copy and save the token securely as it will not be shown again.

- **Set the Token as Environment Variable**:
    - Add the generated token to your `.env` file:
        - `GITHUB_API_TOKEN=<your_token>`