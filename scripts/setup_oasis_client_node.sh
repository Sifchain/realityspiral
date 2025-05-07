#!/bin/bash

# Script to automate TDX host setup and Sapphire client node installation on Phoenix server
# Logs all steps to a file or stdout if not provided, and checks for required tools

# Exit on error
set -e

# Log file (default to /dev/stdout if not provided)
LOG_FILE="${LOG_FILE:-/dev/stdout}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Function to log messages
log() {
    echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
    if [ "$LOG_FILE" != "/dev/stdout" ]; then
        echo "[$TIMESTAMP] $1"
    fi
}

# Function to check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log "ERROR: $1 is required but not installed."
        exit 1
    fi
}

# Function to check if reboot is needed
check_reboot_needed() {
    if [ -f "/var/run/reboot-required" ]; then
        log "Reboot required. Please reboot the system and re-run the script."
        exit 1
    fi
}

# Function to display prerequisites and get confirmation
check_prerequisites() {
    log "======================================================"
    log "PREREQUISITES CHECK"
    log "======================================================"
    
    # Check if server is already deployed
    read -p "Have you already deployed a Phoenix server? (yes/no): " server_deployed
    if [[ ! "$server_deployed" =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Please follow these steps to deploy a Phoenix server:"
        log ""
        log "1. Go to PhoenixNAP API Playground:"
        log "   https://developers.phoenixnap.com/docs/bmc/1/routes/servers/post"
        log ""
        log "2. Click on Authorize and use your API credentials:"
        log "   - If you don't have API credentials, generate them from your Phoenix account"
        log "   - Go to Account -> API Credentials"
        log ""
        log "3. Use the 'POST /servers' endpoint"
        log ""
        log "4. Use this payload:"
        log '{
  "hostname": "oasis-node-1",
  "os": "ubuntu/noble",
  "type": "s4.x6.c6.large",
  "location": "PHX",
  "pricingModel": "HOURLY",
  "installDefaultSshKeys": true
}'
        log ""
        log "5. Click Execute"
        log ""
        log "6. The response will include your server's IP address"
        log ""
        log "7. Use that IP address to connect to the server and run this script"
        log ""
        log "Please deploy the server and run this script again."
        exit 1
    fi

    # Check if running on the Phoenix server
    read -p "Are you running this script directly on the Phoenix server? (yes/no): " running_on_server
    if [[ ! "$running_on_server" =~ ^[Yy][Ee][Ss]$ ]]; then
        log "ERROR: This script must be run directly on the Phoenix server."
        log "Please SSH into your server and run the script there."
        exit 1
    fi

    log "======================================================"
    log "Prerequisites check passed"
    log "======================================================"
}

# Function to setup TDX
setup_tdx() {
    log "Starting TDX setup..."

    # Check for required tools
    log "Checking for required tools..."
    check_command git
    check_command curl
    check_command tar
    check_command rsync
    check_command apt
    check_command systemctl
    check_command dmesg
    check_command rdmsr

    # Update package lists
    log "Updating package lists..."
    sudo apt update -y >> "$LOG_FILE" 2>&1

    # Install dependencies
    log "Installing dependencies..."
    sudo apt install -y bubblewrap apparmor msr-tools >> "$LOG_FILE" 2>&1

    # Check if reboot is needed
    check_reboot_needed

    # Clone TDX repository
    log "Cloning TDX repository..."
    git clone -b main https://github.com/canonical/tdx.git >> "$LOG_FILE" 2>&1

    # Setup TDX host
    log "Setting up TDX host..."
    cd tdx
    sudo ./setup-tdx-host.sh >> "$LOG_FILE" 2>&1
    cd ..

    # Check if reboot is required after TDX setup
    if [ -f "/var/run/reboot-required" ]; then
        log "TDX setup requires a reboot. Rebooting now..."
        sudo reboot
    fi

    # Verify TDX and SGX
    log "Verifying TDX..."
    if sudo dmesg | grep -i tdx | grep -q "module initialized"; then
        log "TDX module initialized successfully"
    else
        log "ERROR: TDX module not initialized"
        exit 1
    fi

    log "Verifying SGX..."
    if sudo dmesg | grep -i sgx | grep -q "EPC section"; then
        log "SGX enabled successfully"
    else
        log "ERROR: SGX not enabled"
        exit 1
    fi

    log "Running system report..."
    if ./tdx/system-report.sh | grep -q "MK_TME_ENABLED bit: 1"; then
        log "System report shows TDX enabled"
    else
        log "ERROR: System report indicates TDX not properly enabled"
        exit 1
    fi

    log "Checking MSR 0x503..."
    if [ "$(sudo rdmsr 0x503)" = "0" ]; then
        log "MSR 0x503 check passed"
    else
        log "ERROR: MSR 0x503 check failed"
        exit 1
    fi

    log "TDX setup completed successfully"
}

# Function to setup Sapphire node
setup_sapphire_node() {
    log "Setting up Sapphire client node..."

    # Create directories
    log "Creating node directories..."
    sudo mkdir -m700 -p /node/{etc,bin,runtimes,data,apps} >> "$LOG_FILE" 2>&1

    # Download genesis file
    log "Downloading genesis.json..."
    sudo curl -L https://github.com/oasisprotocol/testnet-artifacts/releases/download/2023-10-12/genesis.json -o /node/etc/genesis.json >> "$LOG_FILE" 2>&1

    # Download and extract Oasis core
    log "Downloading and extracting Oasis core..."
    sudo curl -L https://github.com/oasisprotocol/oasis-core/releases/download/v25.2/oasis_core_25.2_linux_amd64.tar.gz | sudo tar -xz --strip-components=1 -C /node/bin >> "$LOG_FILE" 2>&1

    # Update PATH
    log "Updating PATH..."
    echo 'export PATH=$PATH:/node/bin' >> ~/.bashrc
    source ~/.bashrc

    # Create oasis user
    log "Creating oasis user..."
    sudo adduser --system oasis --shell /usr/sbin/nologin >> "$LOG_FILE" 2>&1

    # Add permissions
    log "Adding permissions..."
    sudo adduser oasis kvm >> "$LOG_FILE" 2>&1
    sudo adduser oasis sgx >> "$LOG_FILE" 2>&1

    # Set ulimit
    log "Setting ulimit..."
    ulimit -n 102400

    # Configure AppArmor
    log "Configuring AppArmor..."
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
    log "Creating Oasis node systemd service..."
    sudo tee /etc/systemd/system/oasis-node.service << 'EOF' > /dev/null
[Unit]
Description=Oasis Node
After=network.target

[Service]
Type=simple
User=oasis
WorkingDirectory=/node/data
ExecStart=/node/bin/oasis-node --config /node/etc/config.yml
Restart=on-failure
RestartSec=3
LimitNOFILE=1024000

[Install]
WantedBy=multi-user.target
EOF

    # Get IP address
    log "Getting IP address..."
    export IP_ADDRESS=$(ip -4 addr show bond0.2 | grep inet | awk '{print $2}' | cut -d'/' -f1)
    if [ -z "$IP_ADDRESS" ]; then
        log "ERROR: Failed to get IP address"
        exit 1
    fi

    # Set block height and hash
    log "Setting block height and hash..."
    BLOCK_INFO=$(curl -s "https://testnet.nexus.oasis.io/v1/consensus/blocks?limit=1")
    export BLOCK_HEIGHT=$(echo "$BLOCK_INFO" | grep -o '"height":[0-9]*' | cut -d':' -f2)
    export BLOCK_HASH=$(echo "$BLOCK_INFO" | grep -o '"hash":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$BLOCK_HEIGHT" ] || [ -z "$BLOCK_HASH" ]; then
        log "ERROR: Failed to fetch block height and hash from API"
        exit 1
    fi

    log "Retrieved block height: $BLOCK_HEIGHT"
    log "Retrieved block hash: $BLOCK_HASH"

    # Create config.yml
    log "Creating config.yml..."
    sudo tee /node/etc/config.yml << EOF > /dev/null
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
      height: ${BLOCK_HEIGHT}
      hash: "${BLOCK_HASH}"
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
                - ip: ${IP_ADDRESS}
                  protocol: tcp
                  src_port: 5173
                  dst_port: 5173
                - ip: ${IP_ADDRESS}
                  protocol: tcp
                  src_port: 3000
                  dst_port: 3000
EOF

    log "Sapphire node setup completed successfully"
}

# Function to build realityspiral ORC
build_realityspiral() {
    log "Building realityspiral ORC file..."
    cd /node/apps
    git clone https://github.com/Sifchain/realityspiral.git >> "$LOG_FILE" 2>&1
    cd realityspiral
    oasis rofl build >> "$LOG_FILE" 2>&1
    mv realityspiral.default.orc /node/apps/ >> "$LOG_FILE" 2>&1
    cd ..
    rm -rf realityspiral >> "$LOG_FILE" 2>&1
    log "Realityspiral ORC build completed successfully"
}

# Function to setup and verify service
setup_service() {
    log "Setting up and verifying service..."

    # Set ownership
    log "Setting directory ownership..."
    sudo chown -R oasis /node >> "$LOG_FILE" 2>&1

    # Start node temporarily to ensure it works
    log "Starting Oasis node temporarily..."
    sudo -u oasis /node/bin/oasis-node --config /node/etc/config.yml >> "$LOG_FILE" 2>&1 &
    NODE_PID=$!
    sleep 10
    if ! ps -p $NODE_PID > /dev/null; then
        log "ERROR: Oasis node failed to start"
        exit 1
    fi
    kill $NODE_PID

    # Enable and start service
    log "Enabling and starting Oasis node service..."
    sudo systemctl enable oasis-node.service >> "$LOG_FILE" 2>&1
    sudo systemctl start oasis-node.service >> "$LOG_FILE" 2>&1

    # Check service status
    log "Checking Oasis node service status..."
    if sudo systemctl status oasis-node.service | grep -q "active (running)"; then
        log "Oasis node service is running"
    else
        log "ERROR: Oasis node service failed to start"
        exit 1
    fi

    # Install CLI
    log "Installing Oasis CLI..."
    sudo curl -L https://github.com/oasisprotocol/cli/releases/download/v0.13.0/oasis_cli_0.13.0_linux_amd64.tar.gz | sudo tar -xz --strip-components=1 -C /node/bin >> "$LOG_FILE" 2>&1

    # Check node status
    log "Checking node status..."
    sudo -u oasis /node/bin/oasis network add-local localhost unix:internal.sock --config /node/etc/cli.yml >> "$LOG_FILE" 2>&1
    if sudo -u oasis /node/bin/oasis net status --network localhost --config /node/etc/cli.yml | grep -q "syncing"; then
        log "Node is syncing successfully"
    else
        log "ERROR: Node status check failed"
        exit 1
    fi

    log "Service setup and verification completed successfully"
}

# Function to display usage
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo "Options:"
    echo "  -h, --help                 Show this help message"
    echo "  -s, --step STEP            Run a specific step (prerequisites, tdx, sapphire, realityspiral, service)"
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
        log "Running all steps..."
        check_prerequisites
        setup_tdx
        setup_sapphire_node
        build_realityspiral
        setup_service
        log "All steps completed successfully!"
        ;;
    "prerequisites")
        check_prerequisites
        ;;
    "tdx")
        setup_tdx
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
    *)
        log "ERROR: Unknown step: $STEP"
        show_usage
        ;;
esac