# @realityspiral/plugin-bitprotocol

Eliza plugin for interacting with the BitProtocol on Oasis Sapphire.

## Features

*   **Swap Tokens:** Perform stablecoin swaps (Placeholder Implementation).
*   **Monitor Stability:** Check the price stability of BitUSD (Placeholder Implementation).
*   **Find Paths:** Calculate optimal swap paths (Placeholder Implementation).

## Configuration

Requires runtime settings (e.g., environment variables) for:

*   `BITPROTOCOL_RPC_URL`: RPC endpoint for the Oasis Sapphire network (Mainnet or Testnet).
*   `BITPROTOCOL_PRIVATE_KEY`: Private key for the wallet executing transactions.
*   `BITPROTOCOL_MAX_SLIPPAGE` (Optional): Default max slippage (e.g., `0.005` for 0.5%).
*   `BITPROTOCOL_OASIS_NETWORK` (Optional): Network name (`mainnet` or `testnet`, defaults to `mainnet`).

## Development

*   Build: `npm run build` or `pnpm build`
*   Watch: `npm run dev` or `pnpm dev`

**Note:** The core contract interaction logic in the action handlers (`src/actions/bitprotocolActions.ts`) is currently placeholder code. It requires the actual BitProtocol contract ABIs and implementation details for swapping, path finding, and potentially Oasis-specific privacy features. 