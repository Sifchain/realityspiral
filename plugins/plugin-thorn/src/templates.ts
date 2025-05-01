// Template for extracting privacy-preserving swap details
export const swapTemplate = `
Extract the following details for executing a privacy-preserving stablecoin swap using Thorn Protocol:
- **fromToken** (string): The source stablecoin token. Available options: USDC, USDT, DAI, BUSD, FRAX, TUSD, USDD, USDP, GUSD.
- **toToken** (string): The target stablecoin token. Available options: USDC, USDT, DAI, BUSD, FRAX, TUSD, USDD, USDP, GUSD.
- **amount** (string): The amount to swap (as string to handle large numbers).
- **slippage** (number): Maximum acceptable slippage percentage (0-5, default: 0.5).
- **privacyLevel** (string, optional): Privacy level (low, medium, high, default: high).

Ensure that:
1. Both tokens are supported stablecoins from the provided list.
2. Amount is a valid positive number expressed as a string.
3. Slippage is between 0 and 5 percent.
4. Privacy level is one of the provided options.

Provide the details in the following JSON format:

\`\`\`json
{
    "fromToken": "<from_token>",
    "toToken": "<to_token>",
    "amount": "<amount>",
    "slippage": <slippage>,
    "privacyLevel": "<privacy_level>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

// Template for extracting price stability monitoring details
export const priceMonitorTemplate = `
You are setting up price stability monitoring for stablecoins on Thorn Protocol.

Stablecoins are cryptocurrencies designed to maintain a stable value, typically pegged to a fiat currency like the US dollar.
Price stability monitoring helps detect when stablecoins deviate from their expected value, which could indicate risk.

To set up monitoring, you need to specify:
1. Which tokens to monitor (USDC, USDT, DAI, BUSD, FRAX, etc.)
2. The alert threshold (how much deviation is acceptable before alerting, e.g., 0.01 for 1%)
3. How frequently to check prices (in minutes)

For example:
- Monitor USDC, USDT, and DAI with a 1% threshold, checking every 30 minutes
- Track all major stablecoins with a tight 0.5% threshold, checking every 15 minutes

Based on your conversation, generate a monitoring configuration with tokens to monitor, alert threshold, and check interval.
`;

// Template for extracting automated swap strategy details
export const strategyTemplate = `
You are setting up an automated swap strategy for stablecoins on Thorn Protocol.

An automated swap strategy defines rules for converting between stablecoins when certain conditions are met, such as price deviations.

To set up a strategy, you need to specify:
1. A name for the strategy
2. The target token (the stablecoin you want to accumulate)
3. Source tokens (the stablecoins you're willing to swap from)
4. Total budget (how much to allocate to this strategy)
5. Maximum slippage (the maximum price impact you'll accept, e.g., 0.5%)
6. Trigger threshold (how much deviation triggers a swap, e.g., 0.01 for 1%)
7. Privacy level (low, medium, or high - determines the level of transaction privacy)
8. Whether the strategy is active (true/false)

For example:
- "USDC Optimizer" strategy: Target USDC, source from USDT and DAI, 1000 budget, 0.5% max slippage, 0.5% trigger threshold, high privacy
- "DAI Accumulator" strategy: Target DAI, source from USDC and BUSD, 500 budget, 1% max slippage, 1% trigger threshold, medium privacy

Based on your conversation, generate a strategy configuration with appropriate parameters.
`;

// Template for extracting optimal swap path query details
export const optimalPathTemplate = `
Extract the following details for finding the optimal swap path on Thorn Protocol:
- **fromToken** (string): The source stablecoin token. Available options: USDC, USDT, DAI, BUSD, FRAX, TUSD, USDD, USDP, GUSD.
- **toToken** (string): The target stablecoin token. Available options: USDC, USDT, DAI, BUSD, FRAX, TUSD, USDD, USDP, GUSD.
- **amount** (string): The amount to swap (as string to handle large numbers).
- **privacyLevel** (string, optional): Privacy level (low, medium, high, default: high).

Provide the details in the following JSON format:

\`\`\`json
{
    "fromToken": "<from_token>",
    "toToken": "<to_token>",
    "amount": "<amount>",
    "privacyLevel": "<privacy_level>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

// Template for extracting liquidity pool query details
export const liquidityPoolsTemplate = `
Extract the following details for querying liquidity pools on Thorn Protocol:
- **tokens** (array, optional): Filter pools containing specific tokens. Available options: USDC, USDT, DAI, BUSD, FRAX, TUSD, USDD, USDP, GUSD.
- **minLiquidity** (string, optional): Minimum liquidity threshold (as string to handle large numbers).
- **privacyLevel** (string, optional): Privacy level filter (low, medium, high).

Provide the details in the following JSON format:

\`\`\`json
{
    "tokens": ["<token1>", "<token2>", ...],
    "minLiquidity": "<min_liquidity>",
    "privacyLevel": "<privacy_level>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
