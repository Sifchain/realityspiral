import { SAPPHIRE_MAINNET } from "./constants";

// Helper function to format token list
const formatTokenList = (tokens: Record<string, string>): string => {
	return Object.entries(tokens)
		.map(([symbol, address]) => `- ${symbol}: ${address}`)
		.join("\n");
};

// Template for extracting swap parameters
export const swapTemplate = `
Extract the following details for swapping tokens on Neby DEX:
- **fromToken** (string): The contract address of the token to swap FROM.
- **toToken** (string): The contract address of the token to swap TO.
- **amount** (string): The amount of the 'fromToken' to swap, specified in its smallest unit (e.g., wei for ROSE).
- **slippage** (number, optional): The maximum allowed slippage percentage (e.g., 0.5 for 0.5%). If not specified, the default will be used.

Available token contract addresses:
${formatTokenList(SAPPHIRE_MAINNET.TOKENS)}

Provide the details in the following JSON format:

\`\`\`json
{
    "fromToken": "<0x_address>",
    "toToken": "<0x_address>",
    "amount": "<amount_string>",
    "slippage": <slippage_percentage_or_null>
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

// Template for extracting add liquidity parameters
export const addLiquidityTemplate = `
Extract the following details for adding liquidity to a Neby DEX pool:
- **tokenA** (string): The contract address of the first token.
- **tokenB** (string): The contract address of the second token.
- **amountA** (string): The amount of 'tokenA' to add, specified in its smallest unit.
- **amountB** (string): The amount of 'tokenB' to add, specified in its smallest unit.

Provide the details in the following JSON format:

\`\`\`json
{
    "tokenA": "<0x_address>",
    "tokenB": "<0x_address>",
    "amountA": "<amount_string>",
    "amountB": "<amount_string>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

// Template for extracting remove liquidity parameters
export const removeLiquidityTemplate = `
Extract the following details for removing liquidity from a Neby DEX pool:
- **tokenA** (string): The contract address of the first token in the pair.
- **tokenB** (string): The contract address of the second token in the pair.
- **liquidity** (string): The amount of liquidity tokens (or NFT ID representing the position) to remove.

Provide the details in the following JSON format:

\`\`\`json
{
    "tokenA": "<0x_address>",
    "tokenB": "<0x_address>",
    "liquidity": "<liquidity_amount_or_nft_id>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

// Template for extracting monitor prices parameters
export const monitorPricesTemplate = `
Extract the token pairs the user wants to monitor prices for on Neby DEX.
Each pair should consist of two token contract addresses.

- **tokenPairs** (array): An array of pairs, where each pair is an array of two token addresses [address1, address2].

Provide the details in the following JSON format:

\`\`\`json
{
    "tokenPairs": [
        ["<0x_address_1a>", "<0x_address_1b>"],
        ["<0x_address_2a>", "<0x_address_2b>"]
    ]
}
\`\`\`

If no specific pairs are mentioned, ask the user to specify them.

Here are the recent user messages for context:
{{recentMessages}}
`;

// Template for extracting get pool liquidity/info parameters
export const getPoolDetailsTemplate = `
Extract the following details to get information about a Neby DEX pool:
- **tokenA** (string): The contract address of the first token.
- **tokenB** (string): The contract address of the second token.
- **fee** (number, optional): The fee tier of the pool (e.g., 500, 3000, 10000). If not specified, the default (3000) might be assumed or clarification needed.

Provide the details in the following JSON format:

\`\`\`json
{
    "tokenA": "<0x_address>",
    "tokenB": "<0x_address>",
    "fee": <fee_tier_or_null>
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
