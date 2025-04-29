/**
 * Templates for BitProtocol plugin actions
 */

import { validTokenSymbols } from "./schemas";

/**
 * Template for token swap operations on BitProtocol
 */
export const swapTemplate = `
Extract the following details for invoking a smart contract using the BitProtocol SDK:
- **fromTokenSymbol** (string): The symbol of the token to sell (e.g., "ROSE", "BitUSD", "wstROSE").
- **toTokenSymbol** (string): The symbol of the token to buy.
- **amountStr** (string): The amount of the asset to send (as string to handle large numbers)
- **slippage** (number, optional): The maximum acceptable slippage percentage (e.g., 0.005 for 0.5%). Default if not provided.

Provide the details in the following JSON format:

\`\`\`json
{
    "fromTokenSymbol": "<from_token_symbol>",
    "toTokenSymbol": "<to_token_symbol>",
    "amountStr": "<amount_as_string>",
    "slippage": <slippage_percentage>
}
\`\`\`

Example for invoking a transfer method on the USDC contract:

\`\`\`json
{
    "fromTokenSymbol": "ROSE",
    "toTokenSymbol": "BitUSD",
    "amountStr": "1000000",
    "slippage": 0.005
}
\`\`\`


Here are the recent user messages for context:
{{recentMessages}}
`;

/**
 * Template for calculating optimal swap path
 */
export const getPathTemplate = `
Extract the following details for invoking a smart contract using the BitProtocol SDK:
- **fromTokenSymbol** (string): The symbol of the token to sell (e.g., "ROSE", "BitUSD", "wstROSE").
- **toTokenSymbol** (string): The symbol of the token to buy.
- **amountStr** (string , optional): The amount of the asset to send (as string to handle large numbers)

Provide the details in the following JSON format:

\`\`\`json
{
    "fromTokenSymbol": "<from_token_symbol>",
    "toTokenSymbol": "<to_token_symbol>",
    "amountStr": "<amount_as_string>",
}
\`\`\`

Example for invoking a transfer method on the USDC contract:

\`\`\`json
{
    "fromTokenSymbol": "ROSE",
    "toTokenSymbol": "BitUSD",
    "amountStr": "1000000",
}
\`\`\`
Here are the recent user messages for context:
{{recentMessages}}
`;

/**
 * Template for price stability monitoring
 */
export const monitorPriceTemplate = `
User wants to monitor the price stability of a stablecoin. Extract the details:
- tokenSymbol: (string, optional) Symbol of the token to check (e.g., "BitUSD"). Default is "BitUSD" if not specified.
\`\`\`json
{
    "tokenSymbol": "<token_symbol>",
}
\`\`\`

Example for invoking a transfer method on the USDC contract:

\`\`\`json
{
    "tokenSymbol": "BitUSD",
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
