export const stakeTemplate = `
Extract the following details for staking ROSE tokens on Accumulated Finance:
- **amount** (string): The amount of ROSE tokens to stake (e.g., "10", "100.5").
- **receiver** (string, optional): The wallet address to receive the staked tokens. If not provided, the user's own address will be used.

Provide the values in the following JSON format:

\`\`\`json
{
    "amount": "<amount>",
    "receiver": "<receiver_address>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const unstakeTemplate = `
Extract the following details for unstaking ROSE tokens from Accumulated Finance:
- **amount** (string): The amount of ROSE tokens to unstake (e.g., "10", "100.5").
- **receiver** (string, optional): The wallet address to receive the unstaked tokens. If not provided, the user's own address will be used.

Provide the values in the following JSON format:

\`\`\`json
{
    "amount": "<amount>",
    "receiver": "<receiver_address>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const getRewardsTemplate = `
Extract any relevant details for checking staking rewards on Accumulated Finance.
No specific parameters are needed for this operation.

Provide an empty JSON object:

\`\`\`json
{}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const claimRewardsTemplate = `
Extract any relevant details for claiming staking rewards on Accumulated Finance.
No specific parameters are needed for this operation.

Provide an empty JSON object:

\`\`\`json
{}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const getStakingStrategiesTemplate = `
Extract any relevant details for listing available staking strategies on Accumulated Finance.
No specific parameters are needed for this operation.

Provide an empty JSON object:

\`\`\`json
{}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const getStakedBalanceTemplate = `
Extract any relevant details for checking staked balance on Accumulated Finance.
No specific parameters are needed for this operation.

Provide an empty JSON object:

\`\`\`json
{}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const wrapRoseTemplate = `
Extract the following details for wrapping ROSE tokens on Accumulated Finance:
- **amount** (string): The amount of ROSE tokens to wrap (e.g., "10", "100.5").

Provide the values in the following JSON format:

\`\`\`json
{
    "amount": "<amount>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const unwrapRoseTemplate = `
Extract the following details for unwrapping ROSE tokens on Accumulated Finance:
- **amount** (string): The amount of ROSE tokens to unwrap (e.g., "10", "100.5").

Provide the values in the following JSON format:

\`\`\`json
{
    "amount": "<amount>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const mintTemplate = `
Extract the following details for minting stROSE shares on Accumulated Finance:
- **amount** (string): The amount of stROSE shares to mint (e.g., "10", "100.5").
- **receiver** (string, optional): The wallet address to receive the minted shares. If not provided, the user's own address will be used.

Provide the values in the following JSON format:

\`\`\`json
{
    "amount": "<amount>",
    "receiver": "<receiver_address>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const approveTemplate = `
Extract the following details for approving token spending on Accumulated Finance:
- **tokenAddress** (string): The address of the token to approve.
- **spenderAddress** (string): The address of the spender to approve.
- **amount** (string): The amount of tokens to approve (e.g., "10", "100.5").

Provide the values in the following JSON format:

\`\`\`json
{
    "tokenAddress": "<token_address>",
    "spenderAddress": "<spender_address>",
    "amount": "<amount>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const redeemTemplate = `
Extract the following details for redeeming wstROSE shares for ROSE tokens:
- **shares** (string): The amount of wstROSE shares to redeem (e.g., "10", "100.5").
- **receiver** (string, optional): The wallet address to receive the redeemed ROSE tokens. If not provided, the user's own address will be used.
- **owner** (string, optional): The wallet address that owns the shares. If not provided, the user's own address will be used.

Provide the values in the following JSON format:

\`\`\`json
{
    "shares": "<shares>",
    "receiver": "<receiver_address>",
    "owner": "<owner_address>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
