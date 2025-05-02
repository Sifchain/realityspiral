// Template for extracting privacy-preserving swap details
export const swapTemplate = `
Extract the following details for executing a privacy-preserving stablecoin swap using Thorn Protocol:
- **fromToken** (string): The source token. Available options: ROSE, stROSE, USDC, bitUSDs, USDT, OCEAN(Router), OCEAN(Celer).
- **toToken** (string): The target token. Available options: ROSE, stROSE, USDC, bitUSDs, USDT, OCEAN(Router), OCEAN(Celer).
- **amount** (string): The amount to swap (as string to handle large numbers).
- **slippage** (number): Maximum acceptable slippage percentage (0-5, default: 0.03).

Ensure that:
1. Both tokens are supported tokens from the provided list.
2. Amount is a valid positive number expressed as a string.
3. Slippage is between 0 and 5 percent.

Provide the details in the following JSON format:

\`\`\`json
{
    "fromToken": "<from_token>",
    "toToken": "<to_token>",
    "amount": "<amount>",
    "slippage": <slippage>
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

// Template for extracting price stability monitoring details
export const priceMonitorTemplate = `
You are setting up price stability monitoring for tokens on Thorn Protocol.

Tokens are cryptocurrencies that can be traded on the platform.
Price stability monitoring helps detect when tokens deviate from their expected value, which could indicate risk.

To set up monitoring, you need to specify:
1. Which tokens to monitor (ROSE, stROSE, USDC, bitUSDs, USDT, OCEAN(Router), OCEAN(Celer))
2. The alert threshold (how much deviation is acceptable before alerting, e.g., 0.01 for 1%)
3. How frequently to check prices (in minutes)

For example:
- Monitor USDC, USDT, and bitUSDs with a 1% threshold, checking every 30 minutes
- Track all major tokens with a tight 0.5% threshold, checking every 15 minutes

Based on your conversation, generate a monitoring configuration with tokens to monitor, alert threshold, and check interval.
`;

// Template for extracting automated swap strategy details
export const strategyTemplate = `
You are setting up an automated swap strategy for tokens on Thorn Protocol.

An automated swap strategy defines rules for converting between tokens when certain conditions are met, such as price deviations.

To set up a strategy, you need to specify:
1. A name for the strategy
2. The target token (the token you want to accumulate)
3. Source tokens (the tokens you're willing to swap from)
4. Total budget (how much to allocate to this strategy)
5. Maximum slippage (the maximum price impact you'll accept, e.g., 0.5%)
6. Trigger threshold (how much deviation triggers a swap, e.g., 0.01 for 1%)
7. Whether the strategy is active (true/false)

For example:
- "USDC Optimizer" strategy: Target USDC, source from USDT and bitUSDs, 1000 budget, 0.5% max slippage, 0.5% trigger threshold
- "ROSE Accumulator" strategy: Target ROSE, source from stROSE, 500 budget, 1% max slippage, 1% trigger threshold

Based on your conversation, generate a strategy configuration with appropriate parameters.
`;

// Template for extracting optimal swap path query details
export const optimalPathTemplate = `
Extract the following details for finding the optimal swap path on Thorn Protocol:
- **fromToken** (string): The source token. Available options: ROSE, stROSE, USDC, bitUSDs, USDT, OCEAN(Router), OCEAN(Celer).
- **toToken** (string): The target token. Available options: ROSE, stROSE, USDC, bitUSDs, USDT, OCEAN(Router), OCEAN(Celer).
- **amount** (string): The amount to swap (as string to handle large numbers).

Provide the details in the following JSON format:

\`\`\`json
{
    "fromToken": "<from_token>",
    "toToken": "<to_token>",
    "amount": "<amount>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

// Template for extracting liquidity pool query details
export const liquidityPoolsTemplate = `
Extract the following details for querying liquidity pools on Thorn Protocol:
- **tokens** (array, optional): Filter pools containing specific tokens. Available options: ROSE, stROSE, USDC, bitUSDs, USDT, OCEAN(Router), OCEAN(Celer).
- **minLiquidity** (string, optional): Minimum liquidity threshold (as string to handle large numbers).

Provide the details in the following JSON format:

\`\`\`json
{
    "tokens": ["<token1>", "<token2>", ...],
    "minLiquidity": "<min_liquidity>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
