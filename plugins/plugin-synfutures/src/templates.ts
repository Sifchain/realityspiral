export const depositToGateTemplate = `
Extract the following details for depositing to the gate:
- **tokenSymbol** (string): The symbol of the token to deposit (e.g., USDC).
- **amount** (string): The amount to deposit as a string.

Provide the details in the following JSON format:

\`\`\`json
{
    "tokenSymbol": "<token_symbol>",
    "amount": "<amount>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const placeMarketOrderTemplate = `
Extract the following details for placing a market order:
- **instrumentSymbol** (string): The symbol of the instrument (e.g., BTC-USDC-LINK).
- **side** (string): The side of the order (LONG or SHORT).
- **quoteAmount** (string): The amount in quote asset to use for the order.
- **leverage** (string): The desired leverage as a string.

Provide the details in the following JSON format:

\`\`\`json
{
    "instrumentSymbol": "<instrument_symbol>",
    "side": "<side>",
    "quoteAmount": "<quote_amount>",
    "leverage": "<leverage>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const closePositionTemplate = `
Extract the following details for closing a position:
- **instrumentSymbol** (string): The symbol of the instrument (e.g., BTC-USDC-LINK).

Provide the details in the following JSON format:

\`\`\`json
{
    "instrumentSymbol": "<instrument_symbol>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const withdrawFromGateTemplate = `
Extract the following details for withdrawing from the gate:
- **tokenSymbol** (string): The symbol of the token to withdraw (e.g., USDC).
- **amount** (string): The amount to withdraw as a string.

Provide the details in the following JSON format:

\`\`\`json
{
    "tokenSymbol": "<token_symbol>",
    "amount": "<amount>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const getPortfolioTemplate = `
Extract the following details for retrieving a portfolio:
- **walletAddress** (string): The address of the wallet to retrieve the portfolio for.

Provide the details in the following JSON format:

\`\`\`json
{
    "walletAddress": "<wallet_address>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
