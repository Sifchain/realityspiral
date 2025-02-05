# Reality Spiral Repository

This is the main repository for Reality Spiral, a platform that combines custom AI agents with various integrations and plugins. The repository uses Turborepo for managing the monorepo structure and leverages ElizaOS packages where needed.

## Overview

This repository contains the following key components:

### Apps and Packages

- `apps/client`: A modern web application built with React, Vite, and TailwindCSS that serves as the main user interface for Reality Spiral AI chat experience
- `apps/agent`: Core agent implementation and management
- `plugins/`: Integration plugins including:
  - Coinbase integration for cryptocurrency-related features
  - GitHub integration for repository management
- `clients/`: Integration clients including:
  - Coinbase integration for cryptocurrency-related automations
  - GitHub integration for repository automation

## Technology Stack

The entire codebase is written in TypeScript and utilizes:
- React for the frontend
- Vite for build tooling
- TailwindCSS for styling
- ElizaOS packages for core AI functionality
- Turborepo for monorepo management

## Development

To get started with development:

```sh
# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

### Building

To build all apps and packages:

```sh
pnpm build
```

## Project Structure

```
.
├── apps/
│   ├── agent/         # Core agent implementation
│   └── client/        # Main web interface
├── characters/        # Agent character definitions and configurations
├── clients/           # Client libraries and SDKs
├── docs/              # Documentation and guides
└── plugins/           # Integration plugins
```

## Contributing

Please refer to our contributing guidelines for information on how to contribute to Reality Spiral.
