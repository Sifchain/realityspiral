#!/bin/bash

# Container configurations: name -> "port1,port2,type"
declare -A containers=(
    ["agents-prod"]="prod,5010,3010"
    ["prosper-prod"]="prod,5020,3020"
    ["agents-staging"]="staging,5030,3030"
    ["prosper-staging"]="staging,5040,3040"
    ["agents-dev"]="dev,5050,3050"
    ["prosper-dev"]="dev,5060,3060"
)

# navigate to the directory containing this script
cd $(dirname $0)

# Function to log messages with timestamps
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_message "Starting deployment script..."

# check commands are available
command -v docker >/dev/null 2>&1 || { log_message "Error: docker is required but not installed. Aborting." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { log_message "Error: curl is required but not installed. Aborting." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { log_message "Error: jq is required but not installed. Aborting." >&2; exit 1; }

log_message "All required commands are available"

# retrieve the latest release tag for prod containers
log_message "Retrieving latest release tag..."
latest_release=$(curl -s https://api.github.com/repos/Sifchain/realityspiral/releases/latest | jq -r .tag_name)

# Remove 'v' prefix if present
VERSION=${latest_release#v}
log_message "Latest release version: $VERSION"

# retrieve the latest commit hash from main branch for dev containers
log_message "Retrieving latest commit hashes..."
MAIN_COMMIT=$(curl -s https://api.github.com/repos/Sifchain/realityspiral/commits/main | jq -r .sha)
log_message "Latest main branch commit hash: ${MAIN_COMMIT}"

# Get all branches and their latest commits
BRANCHES_JSON=$(curl -s https://api.github.com/repos/Sifchain/realityspiral/branches)
# Extract latest commit from any branch except main
DEV_COMMIT=$(echo "$BRANCHES_JSON" | jq -r '.[] | select(.name != "main") | .commit.sha' | head -n1)
if [ -z "$DEV_COMMIT" ]; then
    log_message "No development branches found, skipping development container deployment"
    DEV_COMMIT=""
else
    log_message "Latest development branch commit hash: ${DEV_COMMIT}"
fi

# Function to deploy containers
deploy_containers() {
    local container_type=$1
    local image_tag=$2
    
    for container in "${!containers[@]}"; do
        IFS=',' read -r type port1 port2 <<< "${containers[$container]}"
        
        # Skip if container type doesn't match
        if [ "$type" != "$container_type" ]; then
            continue
        fi

        log_message "Attempting to deploy ${container} container with ports ${port1} and ${port2} and env file ${container}.env"
        
        # Check if we already have the latest image
        if docker image inspect "ghcr.io/sifchain/realityspiral:${image_tag}" >/dev/null 2>&1; then
            log_message "Docker image for ${image_tag} already exists locally. Skipping deployment."
            continue
        fi

        # Pull the docker image
        log_message "Pulling docker image for tag ${image_tag}..."
        docker pull "ghcr.io/sifchain/realityspiral:${image_tag}"
        
        # Stop and remove existing container if it exists
        if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
            log_message "Stopping and removing existing ${container} container..."
            docker stop ${container}
            docker rm ${container}
        fi
        
        # Create new container
        log_message "Creating ${container} container with ports ${port1} and ${port2} and env file ${container}.env"
        docker run -d \
            --name ${container} \
            -p ${port1}:${port1} \
            -p ${port2}:${port2} \
            -v $(pwd)/${container}.env:/app/.env \
            --restart unless-stopped \
            ghcr.io/sifchain/realityspiral:${image_tag}
    done
}

# Deploy production containers with release version
log_message "Deploying production containers..."
deploy_containers "prod" "${VERSION}"

# Deploy staging containers with main branch commit hash
log_message "Deploying staging containers..."
deploy_containers "staging" "${MAIN_COMMIT}"

# Deploy development containers with latest commit from any branch
if [ ! -z "$DEV_COMMIT" ]; then
    log_message "Deploying development containers..."
    deploy_containers "dev" "${DEV_COMMIT}"
else
    log_message "Skipping development container deployment"
fi

log_message "Deployment completed successfully"
