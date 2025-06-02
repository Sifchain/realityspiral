#!/bin/bash

# Script to automate TDX host setup and Sapphire client node installation on Phoenix server
# Logs all steps to a file or stdout if not provided, and checks for required tools

# Exit on error
set -e

# Get current user
CURRENT_USER=$(logname)

# Log file (default to /dev/stdout if not provided)
LOG_FILE="${LOG_FILE:-/dev/stdout}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    local color=$1
    local message=$2
    
    # If no color specified, use default (blue for info)
    if [ -z "$color" ]; then
        color=$BLUE
    fi
    
    # Format the message with color
    local colored_message="${color}[$TIMESTAMP] $message${NC}"
    
    # If logging to stdout, show colored output
    if [ "$LOG_FILE" = "/dev/stdout" ]; then
        echo -e "$colored_message"
    else
        # Otherwise write plain text to log file
        echo "[$TIMESTAMP] $message" >> "$LOG_FILE"
    fi
}

# Function to log error messages
log_error() {
    log "$RED" "$1"
}

# Function to log success messages
log_success() {
    log "$GREEN" "$1"
}

# Function to log warning messages
log_warning() {
    log "$YELLOW" "$1"
}

# Function to log info messages
log_info() {
    log "$BLUE" "$1"
}

# Function to check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "ERROR: $1 is required but not installed."
        exit 1
    fi
}

# Function to check if reboot is needed
check_reboot_needed() {
    if [ -f "/var/run/reboot-required" ]; then
        log_error "Reboot required. Please reboot the system and re-run the script."
        exit 1
    fi
}

# Function to display colored prompt
prompt() {
    local message=$1
    echo -e "${MAGENTA}$message${NC}"
}

# Function to display prerequisites and get confirmation
check_prerequisites() {
    log_info "======================================================"
    log_info "PREREQUISITES CHECK"
    log_info "======================================================"
    
    # Check if server is already deployed
    read -p "$(prompt "Have you already deployed a Phoenix server? (yes/no): ")" server_deployed
    if [[ ! "$server_deployed" =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Please follow these steps to deploy a Phoenix server:"
        echo ""
        echo "1. Go to PhoenixNAP API Playground:"
        echo "   https://developers.phoenixnap.com/docs/bmc/1/routes/servers/post"
        echo ""
        echo "2. Click on Authorize and use your API credentials:"
        echo "   - If you don't have API credentials, generate them from your Phoenix account"
        echo "   - Go to Account -> API Credentials"
        echo ""
        echo "3. Use the 'POST /servers' endpoint"
        echo ""
        echo "4. Use this payload:"
        echo '{
  "hostname": "oasis-node-1",
  "os": "ubuntu/noble",
  "type": "s4.x6.c6.large",
  "location": "PHX",
  "pricingModel": "HOURLY",
  "installDefaultSshKeys": true
}'
        echo ""
        echo "5. Click Execute"
        echo ""
        echo "6. The response will include your server's IP address"
        echo ""
        echo "7. Use that IP address to connect to the server and run this script"
        echo ""
        echo "Please deploy the server and run this script again."
        exit 1
    fi

    # Check if running on the Phoenix server
    read -p "$(prompt "Are you running this script directly on the Phoenix server? (yes/no): ")" running_on_server
    if [[ ! "$running_on_server" =~ ^[Yy][Ee][Ss]$ ]]; then
        log_error "ERROR: This script must be run directly on the Phoenix server."
        log_error "Please SSH into your server and run the script there."
        exit 1
    fi

    log_info "======================================================"
    log_info "Prerequisites check passed"
    log_info "======================================================"
}

# Function to setup TDX
setup_tdx() {
    log_info "Starting TDX setup..."

    # Check for required tools
    log_info "Checking for required tools..."
    check_command git
    check_command curl
    check_command tar
    check_command apt
    check_command systemctl
    check_command dmesg

    # Update package lists
    log_info "Updating package lists..."
    sudo apt update -y >> "$LOG_FILE" 2>&1

    # Install dependencies
    log_info "Installing dependencies..."
    sudo apt install -y bubblewrap apparmor msr-tools >> "$LOG_FILE" 2>&1

    # Check for installed tools
    check_command rdmsr

    # Check if reboot is needed
    check_reboot_needed

    # Install Docker
    log_info "Installing Docker..."
    sudo apt-get install -y ca-certificates curl >> "$LOG_FILE" 2>&1
    sudo install -m 0755 -d /etc/apt/keyrings >> "$LOG_FILE" 2>&1
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc >> "$LOG_FILE" 2>&1
    sudo chmod a+r /etc/apt/keyrings/docker.asc >> "$LOG_FILE" 2>&1

    # Add Docker repository
    log_info "Adding Docker repository..."
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update >> "$LOG_FILE" 2>&1

    # Install Docker packages
    log_info "Installing Docker packages..."
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >> "$LOG_FILE" 2>&1

    # Clone TDX repository
    log_info "Cloning TDX repository..."
    git clone -b main https://github.com/canonical/tdx.git >> "$LOG_FILE" 2>&1

    # Setup TDX host
    log_info "Setting up TDX host..."
    cd tdx
    sudo ./setup-tdx-host.sh >> "$LOG_FILE" 2>&1
    cd

    # Setup QGS service
    log_info "Setting up QGS service..."
    cd tdx/attestation
    sudo ./setup-attestation-host.sh >> "$LOG_FILE" 2>&1
    cd

    # Start AESMD container
    log_info "Starting AESMD container..."
    sudo docker run \
      --pull always \
      --detach \
      --restart always \
      --device /dev/sgx_enclave \
      --device /dev/sgx_provision \
      --volume /var/run/aesmd:/var/run/aesmd \
      --name aesmd \
      ghcr.io/oasisprotocol/aesmd-dcap:master >> "$LOG_FILE" 2>&1

    # Update SGX PCCS URL configuration
    log_info "Updating SGX PCCS URL configuration..."
    sudo sed -i 's|"pccs_url": "https://localhost:8081/sgx/certification/v4/"|"pccs_url": "https://api.trustedservices.intel.com/sgx/certification/v4/"|' /etc/sgx_default_qcnl.conf >> "$LOG_FILE" 2>&1

    # Check if reboot is required after TDX setup
    if [ -f "/var/run/reboot-required" ]; then
        log_warning "TDX setup requires a reboot. Rebooting now..."
        sudo reboot
    fi

    log_success "TDX setup completed successfully"
}

# Function to verify TDX setup
verify_tdx() {
    log_info "Verifying TDX..."
    if sudo dmesg | grep -i tdx | grep -q "module initialized"; then
        log_success "TDX module initialized successfully"
    else
        log_error "ERROR: TDX module not initialized"
        exit 1
    fi

    log_info "Verifying SGX..."
    if sudo dmesg | grep -i sgx | grep -q "EPC section"; then
        log_success "SGX enabled successfully"
    else
        log_error "ERROR: SGX not enabled"
        exit 1
    fi

    log_info "Running system report..."
    if ./tdx/system-report.sh | grep -q "MK_TME_ENABLED bit: 1"; then
        log_success "System report shows TDX enabled"
    else
        log_error "ERROR: System report indicates TDX not properly enabled"
        exit 1
    fi

    log_info "Checking MSR 0x503..."
    if [ "$(sudo rdmsr 0x503)" = "0" ]; then
        log_success "MSR 0x503 check passed"
    else
        log_error "ERROR: MSR 0x503 check failed"
        exit 1
    fi

    log_success "TDX verification completed successfully"
}

# Function to setup Sapphire node
setup_sapphire_node() {
    log_info "Setting up Sapphire client node..."

    # Check for required tools
    log_info "Checking for required tools..."
    check_command curl
    check_command tar
    check_command systemctl

    # Create directories
    log_info "Creating node directories..."
    sudo mkdir -m700 -p /node/{etc,bin,runtimes,data,apps} >> "$LOG_FILE" 2>&1
    sudo chown -R ${CURRENT_USER}:nogroup /node >> "$LOG_FILE" 2>&1

    # Download genesis file
    log_info "Downloading genesis.json..."
    curl -L https://github.com/oasisprotocol/testnet-artifacts/releases/download/2023-10-12/genesis.json -o /node/etc/genesis.json >> "$LOG_FILE" 2>&1

    # Download and extract Oasis core
    log_info "Downloading and extracting Oasis core..."
    curl -L https://github.com/oasisprotocol/oasis-core/releases/download/v25.3/oasis_core_25.3_linux_amd64.tar.gz | tar -xz --strip-components=1 -C /node/bin >> "$LOG_FILE" 2>&1

    # Install CLI
    log_info "Installing Oasis CLI..."
    curl -L https://github.com/oasisprotocol/cli/releases/download/v0.13.0/oasis_cli_0.13.0_linux_amd64.tar.gz | tar -xz --strip-components=1 -C /node/bin >> "$LOG_FILE" 2>&1

    # Update PATH
    log_info "Updating PATH..."
    echo 'export PATH=$PATH:/node/bin' >> ~/.bashrc
    source ~/.bashrc
    # also add to current session
    export PATH=$PATH:/node/bin

    # Check commands are available
    log_info "Checking for required oasis tools..."
    check_command oasis
    check_command oasis-node
    check_command oasis-core-runtime-loader

    # Add permissions
    log_info "Adding permissions..."
    sudo adduser ${CURRENT_USER} kvm >> "$LOG_FILE" 2>&1
    sudo adduser ${CURRENT_USER} sgx >> "$LOG_FILE" 2>&1

    # Set ulimit
    log_info "Setting ulimit..."
    ulimit -n 102400

    # Configure AppArmor
    log_info "Configuring AppArmor..."
    sudo tee /etc/apparmor.d/bwrap << 'EOF' > /dev/null
abi <abi/4.0>,
include <tunables/global>

profile bwrap /usr/bin/bwrap flags=(unconfined) {
  userns,

  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/bwrap>
}
EOF
    sudo systemctl reload apparmor.service >> "$LOG_FILE" 2>&1

    # Create systemd service
    log_info "Creating Oasis node systemd service..."
    sudo tee /etc/systemd/system/oasis-node.service << EOF > /dev/null
[Unit]
Description=Oasis Node
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=/node/data
ExecStart=/node/bin/oasis-node --config /node/etc/config.yml
Restart=on-failure
RestartSec=3
LimitNOFILE=1024000

[Install]
WantedBy=multi-user.target
EOF

    # Set block height and hash
    log_info "Setting block height and hash..."
    BLOCK_INFO=$(curl -s "https://testnet.nexus.oasis.io/v1/consensus/blocks?limit=1")
    export BLOCK_HEIGHT=$(echo "$BLOCK_INFO" | grep -o '"height":[0-9]*' | cut -d':' -f2)
    export BLOCK_HASH=$(echo "$BLOCK_INFO" | grep -o '"hash":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$BLOCK_HEIGHT" ] || [ -z "$BLOCK_HASH" ]; then
        log_error "ERROR: Failed to fetch block height and hash from API"
        exit 1
    fi

    log_info "Retrieved block height: $BLOCK_HEIGHT"
    log_info "Retrieved block hash: $BLOCK_HASH"

    # Create config.yml
    log_info "Creating config.yml..."
    tee /node/etc/config.yml << EOF > /dev/null
mode: client
common:
    data_dir: /node/data
    log:
        format: JSON
        level:
            cometbft: info
            cometbft/context: error
            default: info
genesis:
    file: /node/etc/genesis.json
consensus:
  state_sync:
    enabled: true
  light_client:
    trust:
      # height: ${BLOCK_HEIGHT}
      # hash: "${BLOCK_HASH}"
      height: 26400000
      hash: "b9e8cc54a911d8a2e268699400d664873efde19ac380098511fb5e38d904a428"
p2p:
    seeds:
      # List of seed nodes to connect to.
      # NOTE: You can add additional seed nodes to this list if you want.
        - HcDFrTp/MqRHtju5bCx6TIhIMd6X/0ZQ3lUG73q5898=@34.86.165.6:26656
        - HcDFrTp/MqRHtju5bCx6TIhIMd6X/0ZQ3lUG73q5898=@34.86.165.6:9200
        - kqsc8ETIgG9LCmW5HhSEUW80WIpwKhS7hRQd8FrnkJ0=@34.140.116.202:26656
        - kqsc8ETIgG9LCmW5HhSEUW80WIpwKhS7hRQd8FrnkJ0=@34.140.116.202:9200
runtime:
    sgx:
        loader: /node/bin/oasis-core-runtime-loader
    paths:
        - /node/apps/realityspiral.default.orc
    runtimes:
      - id: 000000000000000000000000000000000000000000000000a6d1e3ebf60dff6c # Sapphire, automatically downloaded
        config:
          allowed_queries:
              - all_expensive: true
        components:
          - id: rofl.rofl1qpkplp3uq5yage4kunt0ylmulett0arzwcdjvc8u # realityspiral
            networking:
              incoming:
                - ip: 0.0.0.0
                  protocol: tcp
                  src_port: 5173
                  dst_port: 5173
                - ip: 0.0.0.0
                  protocol: tcp
                  src_port: 3000
                  dst_port: 3000
EOF

    log_info "Sapphire node setup completed successfully"
}

# Function to build realityspiral ORC
build_realityspiral() {
    log_info "Building realityspiral ORC file..."

    # Check commands are available
    log_info "Checking for required tools..."
    check_command git
    check_command oasis

    cd

    git clone https://github.com/Sifchain/realityspiral.git >> "$LOG_FILE" 2>&1

    cd realityspiral
    oasis rofl build >> "$LOG_FILE" 2>&1

    mv realityspiral.default.orc /node/apps/ >> "$LOG_FILE" 2>&1

    cd

    log_info "Realityspiral ORC build completed successfully"
}

# Function to setup and verify service
setup_service() {
    log_info "Setting up and verifying service..."

    # Check commands are available
    log_info "Checking for required tools..."
    check_command systemctl
    check_command oasis
    check_command oasis-node

    # Set ownership
    log_info "Setting directory ownership..."
    sudo chown -R ${CURRENT_USER}:nogroup /node >> "$LOG_FILE" 2>&1

    # Start node temporarily to ensure it works
    log_info "Starting Oasis node temporarily..."
    oasis-node --config /node/etc/config.yml >> "$LOG_FILE" 2>&1 &
    NODE_PID=$!
    sleep 10
    if ! ps -p $NODE_PID > /dev/null; then
        log_error "ERROR: Oasis node failed to start"
        exit 1
    fi
    kill $NODE_PID

    # Enable and start service
    log_info "Enabling and starting Oasis node service..."
    sudo systemctl enable oasis-node.service >> "$LOG_FILE" 2>&1
    sudo systemctl start oasis-node.service >> "$LOG_FILE" 2>&1

    # Check service status
    log_info "Checking Oasis node service status..."
    if sudo systemctl status oasis-node.service | grep -q "active (running)"; then
        log_success "Oasis node service is running"
    else
        log_error "ERROR: Oasis node service failed to start"
        exit 1
    fi

    # Sleep for 10 seconds
    log_info "Sleeping for 10 seconds..."
    sleep 10

    # Setup network configuration
    log_info "Setting up network configuration..."
    cd /node/data
    oasis network add-local localhost unix:internal.sock >> "$LOG_FILE" 2>&1
    
    # Check network status
    log_info "Checking network status..."
    if oasis net status --network localhost >> "$LOG_FILE" 2>&1; then
        log_success "Network setup completed successfully"
    else
        log_error "ERROR: Network setup failed"
        exit 1
    fi

    # Get node address
    log_info "Retrieving node address..."
    NODE_ADDRESS=$(oasis-node identity show-address -a unix:internal.sock)
    log_info "Your node address is: $NODE_ADDRESS"
    log_info "Please visit https://faucet.testnet.oasis.io and fund this address on the Sapphire chain to cover gas fees."

    log_success "Service and network setup completed successfully"
}

# Function to display useful commands
commands() {
    echo "======================================================"
    echo "USEFUL COMMANDS"
    echo "======================================================"
    echo "Here are some useful commands for managing your Oasis node:"
    echo ""
    echo "1. Check Oasis node status:"
    echo "   oasis net status --network localhost"
    echo ""
    echo "2. Restart Oasis node:"
    echo "   sudo systemctl restart oasis-node"
    echo ""
    echo "3. View Oasis node logs:"
    echo "   sudo journalctl -fu oasis-node"
    echo ""
    echo "4. View ROFL app logs:"
    echo "   sudo journalctl -fu oasis-node | egrep 'runtime/host|rofl'"
    echo ""
    echo "5. View QGSD service logs:"
    echo "   sudo journalctl -fu qgsd"
    echo ""
    echo "6. View AESMD service logs:"
    echo "   sudo docker logs -f aesmd"
    echo "======================================================"
}

# Function to display usage
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo "Options:"
    echo "  -h, --help                 Show this help message"
    echo "  -s, --step STEP            Run a specific step (prerequisites, tdx, verify, sapphire, realityspiral, service, commands)"
    echo "  -l, --log FILE             Specify log file (default: stdout)"
    echo ""
    echo "If no step is specified, all steps will be run in sequence."
    exit 1
}

# Parse command line arguments
STEP=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            ;;
        -s|--step)
            STEP="$2"
            shift 2
            ;;
        -l|--log)
            LOG_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            ;;
    esac
done

# Create log file if it doesn't exist and isn't stdout
if [ "$LOG_FILE" != "/dev/stdout" ]; then
    sudo touch "$LOG_FILE"
    sudo chmod 644 "$LOG_FILE"
fi

# Run the specified step or all steps
case $STEP in
    "")
        log_info "Running all steps..."
        check_prerequisites
        setup_tdx
        verify_tdx
        setup_sapphire_node
        build_realityspiral
        setup_service
        commands
        log_success "All steps completed successfully!"
        ;;
    "prerequisites")
        check_prerequisites
        ;;
    "tdx")
        setup_tdx
        ;;
    "verify")
        verify_tdx
        ;;
    "sapphire")
        setup_sapphire_node
        ;;
    "realityspiral")
        build_realityspiral
        ;;
    "service")
        setup_service
        ;;
    "commands")
        commands
        ;;
    *)
        log_error "ERROR: Unknown step: $STEP"
        show_usage
        ;;
esac