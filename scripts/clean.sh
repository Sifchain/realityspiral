#!/bin/bash

# Navigate to the script's directory
cd "$(dirname "$0")"/..
echo "Cleanup started."

# Find and remove build artifacts and dependency directories
find . -type d -name "node_modules" -exec rm -rf {} + \
    -o -type d -name "dist" -exec rm -rf {} + \
    -o -type d -name ".turbo" -exec rm -rf {} +

# Remove package manager files
rm -f pnpm-lock.yaml
rm -f yarn.lock
rm -f package-lock.json

# Clean cache directories
rm -rf .turbo
rm -rf .cache

echo "Cleanup completed."
exit 0
