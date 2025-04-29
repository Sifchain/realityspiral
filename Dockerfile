# Use Node.js LTS (matches engine requirement of >=18)
FROM node:23-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm (matches packageManager version)
RUN npm install -g pnpm@9.0.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY clients/client-coinbase/package.json ./clients/client-coinbase/
COPY clients/client-direct/package.json ./clients/client-direct/
COPY clients/client-github/package.json ./clients/client-github/
COPY plugins/plugin-0x/package.json ./plugins/plugin-0x/
COPY plugins/plugin-accumulated-finance/package.json ./plugins/plugin-accumulated-finance/
COPY plugins/plugin-bitprotocol/package.json ./plugins/plugin-bitprotocol/
COPY plugins/plugin-coinbase/package.json ./plugins/plugin-coinbase/
COPY plugins/plugin-coinbase/advanced-sdk-ts/package.json ./plugins/plugin-coinbase/advanced-sdk-ts/
COPY plugins/plugin-email/package.json ./plugins/plugin-email/
COPY plugins/plugin-github/package.json ./plugins/plugin-github/
COPY plugins/plugin-instrumentation/package.json ./plugins/plugin-instrumentation/
COPY plugins/plugin-neby/package.json ./plugins/plugin-neby/
COPY plugins/plugin-rofl/package.json ./plugins/plugin-rofl/
COPY plugins/plugin-synfutures/package.json ./plugins/plugin-synfutures/
COPY plugins/plugin-twitter/package.json ./plugins/plugin-twitter/
COPY agent/package.json ./agent/
COPY ui/package.json ./ui/
COPY packages/sentry/package.json ./packages/sentry/

# Install dependencies
RUN pnpm install

# Copy source files
COPY . .

# Build the project
RUN pnpm build

# Copy .env.example to .env
RUN cp .env.example .env

# Expose the ports (based on .env.example)
EXPOSE 3000 5173

# Start the application
CMD ["pnpm", "start"]