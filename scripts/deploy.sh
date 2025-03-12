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

# PostgreSQL configuration
PG_CONTAINER_NAME="agents-db"
PG_PORT="5432"
PG_USER="postgres"
PG_PASSWORD="postgres"
PG_DB="postgres"  # Default PostgreSQL database
PG_VOLUME="agents-db-data"
DOCKER_NETWORK="agents-network"

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

# Function to ensure the Docker network exists
ensure_network() {
    log_message "Checking Docker network..."
    if ! docker network ls --format '{{.Name}}' | grep -q "^${DOCKER_NETWORK}$"; then
        log_message "Creating Docker network ${DOCKER_NETWORK}..."
        docker network create ${DOCKER_NETWORK}
    else
        log_message "Docker network ${DOCKER_NETWORK} already exists."
    fi
}

# Function to setup PostgreSQL container if it doesn't exist
setup_postgres() {
    log_message "Checking PostgreSQL container..."
    
    # Check if PostgreSQL container exists and is running
    if docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER_NAME}$"; then
        log_message "PostgreSQL container is already running."
        
        # Ensure the container is in the right network
        if ! docker network inspect ${DOCKER_NETWORK} | grep -q "\"${PG_CONTAINER_NAME}\""; then
            log_message "Connecting PostgreSQL container to ${DOCKER_NETWORK} network..."
            docker network connect ${DOCKER_NETWORK} ${PG_CONTAINER_NAME}
        fi
        
        return 0
    fi
    
    # Check if container exists but is not running
    if docker ps -a --format '{{.Names}}' | grep -q "^${PG_CONTAINER_NAME}$"; then
        log_message "PostgreSQL container exists but is not running. Starting it..."
        docker start ${PG_CONTAINER_NAME}
        
        # Ensure the container is in the right network
        if ! docker network inspect ${DOCKER_NETWORK} | grep -q "\"${PG_CONTAINER_NAME}\""; then
            log_message "Connecting PostgreSQL container to ${DOCKER_NETWORK} network..."
            docker network connect ${DOCKER_NETWORK} ${PG_CONTAINER_NAME}
        fi
        
        return 0
    fi
    
    # Check if volume exists, if not create it
    if ! docker volume ls --format '{{.Name}}' | grep -q "^${PG_VOLUME}$"; then
        log_message "Creating PostgreSQL volume ${PG_VOLUME}..."
        docker volume create ${PG_VOLUME}
    fi
    
    # Create PostgreSQL container
    log_message "Creating and starting PostgreSQL container..."
    docker run -d \
        --name ${PG_CONTAINER_NAME} \
        -e POSTGRES_USER=${PG_USER} \
        -e POSTGRES_PASSWORD=${PG_PASSWORD} \
        -e POSTGRES_DB=${PG_DB} \
        -v ${PG_VOLUME}:/var/lib/postgresql/data \
        --network=${DOCKER_NETWORK} \
        --restart unless-stopped \
        postgres
    
    # Wait for PostgreSQL to be ready
    log_message "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Check if PostgreSQL is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER_NAME}$"; then
        log_message "Error: Failed to start PostgreSQL container. Aborting." >&2
        return 1
    fi
    
    log_message "PostgreSQL container is ready."
    return 0
}

# Function to ensure database for a container if it doesn't exist
ensure_container_database() {
    local container_name=$1
    # Replace hyphens with underscores in database name to avoid SQL syntax errors
    local container_db="db_${container_name//-/_}"
    
    log_message "Ensuring database exists for ${container_name}..." >&2
    
    # Check if database exists
    local db_exists=$(docker exec -i ${PG_CONTAINER_NAME} psql -U ${PG_USER} -t -c "SELECT 1 FROM pg_database WHERE datname='${container_db}'")
    
    # Create database if it doesn't exist
    if [ -z "$db_exists" ] || [ "$db_exists" != " 1" ]; then
        log_message "Creating database '${container_db}' for ${container_name}..." >&2
        docker exec -i ${PG_CONTAINER_NAME} psql -U ${PG_USER} -c "CREATE DATABASE ${container_db}"
    else
        log_message "Database '${container_db}' already exists for ${container_name}." >&2
    fi
    
    echo "${container_db}"
}

# Function to get the specific version tag from an image
get_version_tag() {
    local image_name=$1
    local tag=$2
    local version_tag=""
    
    # Pull the image first
    if ! docker pull "${image_name}:${tag}" >/dev/null 2>&1; then
        log_message "Failed to pull image ${image_name}:${tag} for version check"
        return 1
    fi
    
    if [ "$tag" == "latest" ]; then
        # For prod/latest, get the version from label prefixing with v
        version_tag="v$(docker inspect "${image_name}:${tag}" --format='{{index .Config.Labels "org.opencontainers.image.version"}}' 2>/dev/null)"
    else
        # For staging/dev, get the short SHA
        version_tag=$(docker inspect "${image_name}:${tag}" --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null | cut -c1-7)
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
        
        # Ensure container database exists and get its name
        local container_db=$(ensure_container_database "${container}")
        
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
            -e POSTGRES_HOST="${PG_CONTAINER_NAME}" \
            -e POSTGRES_PORT="${PG_PORT}" \
            -e POSTGRES_USER="${PG_USER}" \
            -e POSTGRES_PASSWORD="${PG_PASSWORD}" \
            -e POSTGRES_DB="${container_db}" \
            --network=${DOCKER_NETWORK} \
            --restart unless-stopped \
            ghcr.io/sifchain/realityspiral:${image_tag}
    done
}

# Ensure Docker network exists
ensure_network

# Setup PostgreSQL container
if ! setup_postgres; then
    log_message "Failed to setup PostgreSQL container. Aborting deployment."
    exit 1
fi

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
