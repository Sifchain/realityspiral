# ROFL Plugin

The ROFL plugin provides integration with the ROFL `appd` service for cryptographic key generation and management. It allows agents to generate various types of cryptographic keys through a Unix domain socket connection to the ROFL service.

## Features

- Generate cryptographic keys with different algorithms:
  - `raw-256`: Generate 256 bits of entropy
  - `raw-384`: Generate 384 bits of entropy
  - `ed25519`: Generate an Ed25519 private key
  - `secp256k1`: Generate a Secp256k1 private key
- Automatic key generation using agent ID
- Secure communication via Unix domain socket

## Configuration

To enable the ROFL plugin, set the following environment variable:

```bash
ROFL_PLUGIN_ENABLED=true
```

The plugin requires the ROFL service to be running and accessible via the Unix domain socket at `/run/rofl-appd.sock`.

## Usage

### As an Action

The plugin provides a `GET_AGENT_ROFL_KEY` and `GET_ROFL_KEY` actions that can be used to generate and display keys with specific parameters:

```
User: Show me the agent ROLF key
System: Here is the agent ROFL key: <key>
```

### As a Provider

The plugin provides a key generation provider that automatically uses the agent's ID and generates a secp256k1 key. The generated key is stored in the agent's state and can be accessed through the agent state.

## Error Handling

The plugin includes comprehensive error handling:
- Validates socket availability before attempting operations
- Provides detailed error messages for troubleshooting
- Logs errors for monitoring and debugging

## Security Considerations

- All communication with the ROFL service is done through a Unix domain socket
- Keys are generated securely by the ROFL service
- Generated keys are stored in the agent's state for persistence
