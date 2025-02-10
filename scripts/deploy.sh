#!/bin/bash

# Function to log messages with timestamps
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_message "Starting deployment script..."

# check commands are available
command -v tmux >/dev/null 2>&1 || { log_message "Error: tmux is required but not installed. Aborting." >&2; exit 1; }
command -v git >/dev/null 2>&1 || { log_message "Error: git is required but not installed. Aborting." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { log_message "Error: curl is required but not installed. Aborting." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { log_message "Error: jq is required but not installed. Aborting." >&2; exit 1; }

log_message "All required commands are available"

# First fetch all tags from the repository
log_message "Fetching all tags from repository..."
git fetch --all --tags

# Get current branch
current_branch=$(git symbolic-ref --short HEAD || git describe --tags)
log_message "Current branch/tag: $current_branch"

# retrieve the latest release tag
log_message "Retrieving latest release tag..."
latest_release=$(curl -s https://api.github.com/repos/Sifchain/realityspiral/releases/latest | jq -r .tag_name)
log_message "Latest release tag: $latest_release"

# if the latest release is the same as the current branch, then exit
if [ "$latest_release" == "$current_branch" ]; then
    log_message "Already on latest release. No deployment needed."
    exit 0
fi

# if pnpm-lock.yaml changed, then discard changes
if [ -f "pnpm-lock.yaml" ]; then
    log_message "pnpm-lock.yaml changed. Discarding changes..."
    git checkout -- pnpm-lock.yaml
fi

# name tmux session based on folder name
tmux_session_name=$(basename $(pwd))
log_message "Tmux session name: $tmux_session_name"

# if tmux session already exists, then stop it
if tmux has-session -t $tmux_session_name; then
    log_message "Killing existing tmux session..."
    tmux kill-session -t $tmux_session_name
fi

# checkout the latest release
log_message "Checking out latest release: $latest_release"
git checkout $latest_release

# install dependencies
log_message "Installing dependencies..."
pnpm install

# build the project
log_message "Building project..."
pnpm build

# start a new tmux session
log_message "Starting new tmux session..."
tmux new-session -d -s $tmux_session_name

# run the project
log_message "Starting application..."
tmux send-keys -t $tmux_session_name "pnpm start" C-m

log_message "Deployment completed successfully"
