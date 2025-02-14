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

log_message "All required commands are available"

# Function to get the specific version tag from an image
get_version_tag() {
    local image_name=$1
    local tag=$2
    local version_tag=""
    
    # Pull the image first
    if ! docker pull "${image_name}:${tag}" >/dev/null 2>&1; then
        log_message "Failed to pull image ${image_name}:${tag} for version check"
        return 1
    }
    
    if [ "$tag" == "latest" ]; then
        # For prod/latest, get the version from label
        version_tag=$(docker inspect "${image_name}:${tag}" --format='{{index .Config.Labels "org.opencontainers.image.version"}}' 2>/dev/null)
    else
        # For staging/dev, get the SHA
        version_tag=$(docker inspect "${image_name}:${tag}" --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null)
    fi
    
    if [ -z "$version_tag" ]; then
        log_message "Could not retrieve version/SHA tag, falling back to '${tag}'"
        echo "$tag"
        return 0
    fi
    
    echo "$version_tag"
}

# Function to deploy containers
deploy_containers() {
    local container_type=$1
    local image_tag=$2
    
    # Get the specific version/SHA tag based on container type
    local version_tag=$(get_version_tag "ghcr.io/sifchain/realityspiral" "$image_tag")
    log_message "Using version/SHA tag: ${version_tag} for ${container_type} deployment"
    
    for container in "${!containers[@]}"; do
        IFS=',' read -r type port1 port2 <<< "${containers[$container]}"
        
        # Skip if container type doesn't match
        if [ "$type" != "$container_type" ]; then
            continue
        fi

        log_message "Attempting to deploy ${container} container with ports ${port1} and ${port2} and env file ${container}.env"
        
        # Pull the image to check for updates
        log_message "Pulling docker image for tag ${image_tag}..."
        if ! docker pull "ghcr.io/sifchain/realityspiral:${image_tag}"; then
            log_message "Failed to pull image for ${container}. Skipping..."
            continue
        fi

        # Get the ID of the currently running container's image (if it exists)
        current_image_id=""
        if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
            current_image_id=$(docker inspect ${container} --format='{{.Image}}')
        fi

        # Get the ID of the newly pulled image
        new_image_id=$(docker inspect "ghcr.io/sifchain/realityspiral:${image_tag}" --format='{{.Id}}')

        # If the image IDs match, skip deployment
        if [ ! -z "$current_image_id" ] && [ "$current_image_id" == "$new_image_id" ]; then
            log_message "Container ${container} is already running the latest image. Skipping..."
            continue
        fi
        
        # Stop and remove existing container if it exists
        if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
            log_message "Stopping and removing existing ${container} container..."
            docker stop ${container}
            docker rm ${container}
        fi
        
        # Create new container with VERSION environment variable
        log_message "Creating ${container} container with ports ${port1} and ${port2} and env file ${container}.env"
        docker run -d \
            --name ${container} \
            -p ${port1}:${port1} \
            -p ${port2}:${port2} \
            -v $(pwd)/${container}.env:/app/.env \
            -e VERSION="${version_tag}" \
            --restart unless-stopped \
            ghcr.io/sifchain/realityspiral:${image_tag}
    done
}

# Deploy production containers with specific version tag
log_message "Deploying production containers..."
deploy_containers "prod" "latest"  # The actual tag will be replaced in the function

# Deploy staging containers
log_message "Deploying staging containers..."
deploy_containers "staging" "staging"

# Deploy development containers
log_message "Deploying development containers..."
deploy_containers "dev" "dev"

log_message "Deployment completed successfully"
