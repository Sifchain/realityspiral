# Reality Spiral Repository

This is the main repository for Reality Spiral, a platform that combines custom AI agents with various integrations and plugins. The repository uses Turborepo for managing the monorepo structure and leverages ElizaOS packages where needed.

## Overview

This repository contains the following key components:

- `agent`: Core agent implementation and management
- `plugins/`: Integration plugins including:
  - Coinbase integration for cryptocurrency-related features
  - GitHub integration for repository management
- `clients/`: Integration clients including:
  - Coinbase integration for cryptocurrency-related automations
  - GitHub integration for repository automation
- `ui`: A modern web application built with React, Vite, and TailwindCSS that serves as the main user interface for Reality Spiral AI chat experience

## Technology Stack

The entire codebase is written in TypeScript and utilizes:
- React for the frontend
- Vite for build tooling
- TailwindCSS for styling
- ElizaOS packages for core AI functionality
- Turborepo for monorepo management

## Development

To get started with development:

Install `biome` globally on your system and configure it in your preferred code editor before proceeding.

Here is an example of how to enable biome on VSCode:

1. Install the Biome extension from the VSCode marketplace
2. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Type "Preferences: Open Settings (JSON)"
4. Add the following to the JSON file and save:

```json
{
  "editor.formatOnSaveMode": "modifications",
  "editor.formatOnSave": true,
  "editor.formatOnSaveMode": "modifications",
  "editor.formatOnSave": true,
  "[typescript]": {
      "editor.defaultFormatter": "biomejs.biome"
  },
  "editor.codeActionsOnSave": {
      "quickfix.biome": "explicit"
  },
  "[jsonc]": {
      "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
      "editor.defaultFormatter": "biomejs.biome"
  }
}
```

Then execute these commands to set up the development environment:

```sh
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Set POSTGRES_URL=postgresql://user@localhost:5432/tracing_database, 
# Set UI_SERVER_URL = http://localhost:3000
# Set SERVER_PORT=3000

# Start with a specific character

# start with staff-engineer
CHARACTER=characters/staff-engineer.character.json pnpm dev

# start with prosper
CHARACTER=characters/prosper.character.json pnpm dev

# start with staff-engineer and prosper
CHARACTERS=characters/staff-engineer.character.json,characters/prosper.character.json pnpm dev
```

### Building

To build all apps and packages:

```sh
pnpm build
```

## Project Structure

```
.
├── agent/            # Core agent implementation
├── characters/       # Agent character definitions and configurations
├── clients/          # Integration clients
│   ├── coinbase/    # Coinbase API client
│   ├── direct/      # Custom Eliza Direct API client
│   └── github/      # GitHub API client
├── docs/            # Documentation and guides
├── plugins/         # Integration plugins
│   ├── coinbase/    # Coinbase trading and payment plugins
│   ├── email/       # Custom Eliza Email integration plugins
│   ├── github/      # GitHub repository automation plugins
│   └── twitter/     # Custom Eliza Twitter/X social media plugins
└── ui/              # User interface components and utilities
```

## Releasing New Versions

To release a new version of Reality Spiral:

1. Go to the GitHub repository's [Draft a new release](https://github.com/Sifchain/realityspiral/releases/new) page
2. Create a new tag following [semver.org semantic versioning](https://semver.org/) (e.g., `v0.9.3`)
3. Use the same version number as the release title (e.g., `v0.9.3`)
4. Click on the "Generate release notes" button
5. Click "Publish release"

This will trigger the production Docker workflow which:
- Builds a new Docker image
- Tags it with the release version
- Pushes it to GitHub Container Registry (ghcr.io)
- Automatically deploys the new version to production

The Docker image will be tagged with:
- Full version (e.g., `v0.9.3`)
- Minor version (e.g., `0.9`)
- Major version (e.g., `0`)

## Deployment to Docker server

Reality Spiral uses an advanced deployment system with three environments (production, staging, and development) managed through Docker containers and GitHub Actions workflows.

### Deployment Architecture

The system consists of:
- Multiple containerized services (agents and prosper instances)
- A shared PostgreSQL database
- A custom Docker network for container communication

### Environment Configurations

Each environment has dedicated containers with specific ports:

- **Production**
  - agents-prod (ports: 5010, 3010)
  - prosper-prod (ports: 5020, 3020)
- **Staging**
  - agents-staging (ports: 5030, 3030) 
  - prosper-staging (ports: 5040, 3040)
- **Development**
  - agents-dev (ports: 5050, 3050)
  - prosper-dev (ports: 5060, 3060)

### Deployment Process

The deployment process is automated through GitHub Actions workflows:

1. **Production Deployments** (`docker-prod.yml`)
   - Triggered by publishing a new release
   - Tags images with semantic version numbers (e.g., v1.2.3, 1.2, 1)
   - Deploys to production environment

2. **Staging Deployments** (`docker-staging.yml`)
   - Triggered by pushes to the `main` branch
   - Tags images with commit SHA and 'staging' tag
   - Deploys to staging environment

3. **Development Deployments** (`docker-dev.yml`)
   - Triggered by pushes to non-main branches
   - Tags images with commit SHA and 'dev' tag
   - Deploys to development environment

### Deployment Script

The `deploy.sh` script handles the actual deployment process:

1. Creates/ensures a Docker network exists
2. Sets up and manages a PostgreSQL container
3. Creates separate databases for each service
4. Pulls the latest Docker images
5. Deploys or updates containers with appropriate configurations
6. Manages environment variables and port mappings

### Database Management

- Each service gets its own database within a shared PostgreSQL instance
- Database names are automatically generated based on container names
- Data persistence is handled through a Docker volume

### Version Management

- Production releases use semantic versioning (v1.2.3)
- Staging builds are tagged with commit SHAs and 'staging'
- Development builds are tagged with commit SHAs and 'dev'
- All images are stored in GitHub Container Registry (ghcr.io)

### Automatic Updates

The deployment script checks for image updates before deploying:
- Compares current and new image IDs
- Only deploys if there's a new version available
- Maintains container state and configurations

## Deployment to TEE environment

Reality Spiral can be deployed to a Trusted Execution Environment (TEE) using the [Oasis SDK](https://github.com/oasisprotocol/oasis-sdk). Below we are describing how to deploy Reality Spiral to a TEE environment using the Oasis ROFL tool.

### Prerequisites

Install the Oasis CLI using the latest release from the [Oasis CLI releases page](https://github.com/oasisprotocol/cli/releases).

### Account Setup

Create a new account using the Oasis CLI.

```sh
oasis-cli account create --name <account-name>
```

Request testnet tokens from the [Oasis Faucet](https://faucet.testnet.oasis.dev/).

### Create a ROFL application

Note: Reality Spiral already has a ROFL app created with ID `rofl1qpkplp3uq5yage4kunt0ylmulett0arzwcdjvc8u`. The following steps are only needed if you want to create your own ROFL application instead of using the existing one.

Choose a unique deployment name for your ROFL application instance.

```sh
export DEPLOYMENT_NAME=<deployment-name>
```

Note: When specifying your deployment name, choose something other than `default` since this name is reserved for the existing Reality Spiral ROFL application. The deployment name identifies your specific instance in the configuration.

Create the ROFL application.

```sh
oasis rofl create --network testnet --account <account-name> --deployment ${DEPLOYMENT_NAME}
```

```
Broadcasting transaction...
Transaction included in block successfully.
Round:            10956862
Transaction hash: 5e82260f0b8027213e065af8a27af53dd1743bbcce7e567352f8bbcdce4f7d77
Execution successful.
Created ROFL app: rofl1qpkplp3uq5yage4kunt0ylmulett0arzwcdjvc8u
```

Retrieve the ROFL app information.

```sh
oasis rofl show --deployment ${DEPLOYMENT_NAME}
```

```
App ID:        rofl1qpkplp3uq5yage4kunt0ylmulett0arzwcdjvc8u
Admin:         oasis1qryq3zag4v6cem8t3v8ahjd3wa3ugdtwcgrpp9nr
Staked amount: 100.0 TEST
Metadata:
  net.oasis.rofl.name: realityspiral
  net.oasis.rofl.version: 0.11.1
Policy:
  {
    "quotes": {
      "pcs": {
        "tcb_validity_period": 30,
        "min_tcb_evaluation_data_number": 18,
        "tdx": {}
      }
    },
    "enclaves": [],
    "endorsements": [
      {
        "any": {}
      }
    ],
    "fees": 2,
    "max_expiration": 3
  }

=== Instances ===
No registered app instances.
```

### Update the `rofl-compose.yaml` file

Edit the `rofl-compose.yaml` file with the following content:

```yaml
services:
  realityspiral:
    restart: always
    image: ghcr.io/sifchain/realityspiral:staging
    build:
      context: .
      dockerfile: Dockerfile
    platform: linux/amd64
    environment:
      - CHARACTERS=${CHARACTERS}
      - SERVER_PORT=${SERVER_PORT}
      [...]
```

Add all required environment variables to the rofl-compose.yaml file to properly configure and run the Reality Spiral agent.

#### Encrypt the secrets inside the manifest file

The following commands demonstrate how to encrypt each environment variable as a secret in the manifest:

```sh
echo -n "characters/staff-engineer.character.json" | oasis rofl secret set  --deployment ${DEPLOYMENT_NAME} CHARACTERS -
echo -n "3000" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} SERVER_PORT -
echo -n "5173" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} UI_PORT -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} UI_ALLOWED_HOSTS -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} UI_SERVER_URL -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} REMOTE_CHARACTER_URLS -
echo -n "false" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} USE_CHARACTER_STORAGE -
echo -n "log" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} DEFAULT_LOG_LEVEL -
echo -n "false" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} LOG_JSON_FORMAT -
echo -n "false" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} INSTRUMENTATION_ENABLED -
echo -n "true" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} ROFL_PLUGIN_ENABLED -
echo -n "false" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} ACCUMULATED_FINANCE_ENABLED -
echo -n "false" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} BITPROTOCOL_ENABLED -
echo -n "false" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} NEBY_ENABLED -
echo -n "false" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} THORN_ENABLED -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} EXPRESS_MAX_PAYLOAD -
echo -n "sk-proj-XXXX" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} OPENAI_API_KEY -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} OPENAI_API_URL -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} SMALL_OPENAI_MODEL -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} MEDIUM_OPENAI_MODEL -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} LARGE_OPENAI_MODEL -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} EMBEDDING_OPENAI_MODEL -
echo -n "" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} IMAGE_OPENAI_MODEL -
echo -n "false" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} USE_OPENAI_EMBEDDING -
echo -n "true" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} GITHUB_CLIENT_DISABLED -
echo -n "true" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} GITHUB_PLUGIN_ENABLED -
echo -n "ghp_XXXX" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} GITHUB_API_TOKEN -
echo -n "5000" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} GITHUB_USER_CHECK_INTERVAL_MS -
echo -n "5000" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} GITHUB_INFO_DISCOVERY_INTERVAL_MS -
echo -n "20000" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} GITHUB_OODA_INTERVAL_MS -
echo -n "10" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} GITHUB_ISSUES_LIMIT -
echo -n "10" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} GITHUB_PULL_REQUESTS_LIMIT -
echo -n "postgresql://user:password@localhost:5432/realityspiral" | oasis rofl secret set --deployment ${DEPLOYMENT_NAME} POSTGRES_URL -
```

You can customize the manifest file by adding additional secrets that your agent requires.

After encrypting all the secrets, update the ROFL app's on-chain configuration by running:

```sh
oasis rofl update --deployment ${DEPLOYMENT_NAME}
```

```
Broadcasting transaction...
Transaction included in block successfully.
Round:            10957828
Transaction hash: e19455bbd8a47322c2cabdf1b06213b4bd75eeaf2ac40207185a9343cf2047cc
Execution successful.
```

### Build the ROFL app

Let's proceed with building the ROFL app.

For MacOS users, the following Docker image provides the necessary build environment. You can find detailed information about this image in the [prerequisites documentation](https://docs.oasis.io/build/rofl/prerequisites).

```sh
docker run --platform linux/amd64 --volume .:/src --rm -it ghcr.io/oasisprotocol/rofl-dev:main
```

Once inside the container, build the ROFL app by running:

```sh
oasis rofl build --update-manifest --deployment ${DEPLOYMENT_NAME}
```

```
Building a ROFL application...
Deployment: default
Network:    testnet
ParaTime:   sapphire
Debug:      false
App ID:     rofl1qpkplp3uq5yage4kunt0ylmulett0arzwcdjvc8u
Name:       realityspiral
Version:    0.11.1
TEE:        tdx
Kind:       container
Building a container-based TDX ROFL application...
Downloading firmware artifact...
[...]
Preparing stage 2 root filesystem...
Unpacking template...
Adding runtime as init...
Adding extra files...
Creating squashfs filesystem...
Creating dm-verity hash tree...
Creating ORC bundle...
ROFL app built and bundle written to 'realityspiral.default.orc'.
Computing enclave identity...
Update the manifest with the following identities to use the new app:

deployments:
  default:
    policy:
      enclaves:
        - "+gwV6aqbsA3jz7sgr3FI8IDB0IurwhwDJGtntGQhA7AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
        - "yzklQN6SBWWcaHxn6rUfASq6YYMBf4A4e3ZkZE1OWNEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
```

Upon completion, the build process generates a file named `realityspiral.default.orc`.

### Deploy the ROFL app

To learn how to deploy your ROFL app to either a self-hosted Oasis node or through an Oasis provider, run the following command:

```sh
oasis rofl deploy --deployment ${DEPLOYMENT_NAME}
```

```
To deploy your ROFL app, you can decide between one of the two options:

A. RUN YOUR OWN OASIS NODE

   1. Follow https://docs.oasis.io/node/run-your-node/paratime-client-node
      and configure your TDX Oasis node
   2. Copy 'realityspiral.default.orc' to your node, for example:

      scp realityspiral.default.orc mynode.com:/node/rofls

   3. Add the following snippet to your Oasis node config.yml:

      runtime:
        paths:
          - /node/rofls/realityspiral.default.orc

   4. Restart your node

B. DEPLOY YOUR ROFL TO THE OASIS PROVIDER

   1. Upload 'realityspiral.default.orc' to a publicly accessible file server
   2. Reach out to us at https://oasis.io/discord #dev-central channel and we
      will run your ROFL app on our TDX Oasis nodes
```

## Contributing

Please refer to our contributing guidelines for information on how to contribute to Reality Spiral.
