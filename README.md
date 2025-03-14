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

## Contributing

Please refer to our contributing guidelines for information on how to contribute to Reality Spiral.

