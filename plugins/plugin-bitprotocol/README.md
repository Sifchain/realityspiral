# @realityspiral/plugin-bitprotocol

Eliza plugin for interacting with the BitProtocol on Oasis Sapphire network with privacy-preserving features.

## Features

*   **Swap Tokens:** Perform stablecoin swaps between BitUSD and various collateral tokens.
*   **Private Swaps:** Execute confidential transactions using Oasis Sapphire's TEE capabilities.
*   **Monitor Stability:** Check the price stability of BitUSD against its peg.
*   **Find Optimal Paths:** Calculate the most efficient swap routes for token exchanges.

## Configuration

Requires runtime settings (e.g., environment variables) for:

*   `BITPROTOCOL_RPC_URL`: RPC endpoint for the Oasis Sapphire network (Mainnet or Testnet).
*   `BITPROTOCOL_NETWORK_ID`: Chain ID for the Oasis Sapphire network.
*   `BITPROTOCOL_MAX_SLIPPAGE` (Optional): Default max slippage (e.g., `0.005` for 0.5%).
*   `BITPROTOCOL_PRIVACY_ENABLED` (Optional): Enable/disable privacy features (defaults to `true`).

## Supported Tokens

* BitUSD (BitProtocol stablecoin)
* BIT (BitProtocol governance token)
* ROSE (Native Oasis token)
* wstROSE (Wrapped staked ROSE)
* mTBill (Maturity Treasury Bill)

## Privacy Features

This plugin leverages Oasis Sapphire's confidential computing environment to provide:

* Confidential transactions that hide transaction details
* Encrypted swap data using the Trusted Execution Environment (TEE)
* Private token approvals
* Secure key management

## Development

*   Build: `npm run build` or `pnpm build`
*   Watch: `npm run dev` or `pnpm dev`
*   Test: `npm run test` or `pnpm test`

## Integration with BitProtocol

This plugin integrates directly with BitProtocol's smart contracts on the Oasis Sapphire network, providing a secure, privacy-preserving interface for stablecoin operations. 