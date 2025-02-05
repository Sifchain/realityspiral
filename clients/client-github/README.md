# Guide to Using the GitHub Client

This guide provides detailed instructions for setting up and using the GitHub client with a specific pull request (PR) branch in the \`sa-eliza\` repository. Follow these steps to configure and test the system before the PR is merged into the `sif-dev` branch.

## Prerequisites

- Access to a terminal with `git`, `pnpm`, and a compatible Node.js version installed.
- Internet connection to clone the repository and install dependencies.

## Setup Instructions

### 1. Clone the Repository

Clone the `sa-eliza` repository to your local machine:

```bash
git clone https://github.com/Sifchain/sa-eliza.git
```

### 2. Checkout the PR Branch

Navigate to the repository folder and checkout the `sif-dev` branch:

```bash
cd sa-eliza
git checkout sif-dev
```

### 3. Ensure Secure Configuration

Set the following environment variables within the `.env` file. See the next section to know how to create a new GitHub API token.

- `GITHUB_API_TOKEN`: API key for GitHub API access.

### 4. Creating a GitHub Classic Token with `public_repo` Scope

To generate a GitHub Classic token with the required `public_repo` scope, follow these steps:

- **Log in to GitHub**: Go to [GitHub](https://github.com/) and log in to your account.

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
    - `GITHUB_API_TOKEN=<your_token>`bash
      cd sa-eliza
      git checkout feat/client-github-load-github-info-via-messages

### 5. Install Dependencies

Install all necessary dependencies:

```
pnpm install -r --no-frozen-lockfile
```

### 6. Build the Packages

Build the project packages:

```bash
pnpm build
```

### 7. Start the Agent

Start the agent along with the desired character configuration:

```bash
pnpm cleanstart --character=characters/staff-engineer.character.json
```

### 8. Start the Eliza UI

Run the following command to start the Eliza user interface:

```bash
pnpm start:client
```

### 9. Open the Eliza UI in a Browser

Open the Eliza UI in your web browser at the following URL:

```
http://localhost:5173/
```

### 10. Select the Staff Engineer Agent

From the UI, select the **Staff Engineer** agent. Send the following message to trigger the GitHub client process:

```
Configure the GitHub repository `snobbee/todo-list` on main branch
```

You may use another repository if desired. The specified repository is public and contains a simple todo-list app written in Node.js. You can view it here:
[https://github.com/snobbee/todo-list](https://github.com/snobbee/todo-list)

### 11. Observe the Process and Validate

You should see several messages added to the chat history:

- Configure repo settings
- Initialize repo
- Memorize repo
- Create issues

Visit the repository link to view the created issues:
[https://github.com/snobbee/todo-list/issues](https://github.com/snobbee/todo-list/issues)

## Notes

- Ensure that your environment meets all prerequisites to avoid errors.
- If you encounter issues during setup or usage, review the terminal output for debugging information.

