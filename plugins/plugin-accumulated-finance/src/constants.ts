// Oasis Sapphire Mainnet details
export const SAPPHIRE_MAINNET = {
	RPC_URL: "https://sapphire.oasis.io",
	CHAIN_ID: 0x5afe,
	EXPLORER_URL: "https://explorer.oasis.io/mainnet/sapphire",
	CONTRACTS: {
		// UNSTAKE: "0x04faf6897cf5de4ab9f1052fa16ec9256c3ea44a", // Removed - Not used in current implementation
		WRAPPED_ROSE: "0x3cabbe76ea8b4e7a2c0a69812cbe671800379ec8", // wstROSE contract (wrapped staked ROSE)
		UNWRAPPED_ROSE: "0xed57966f1566de1a90042d07403021ea52ad4724", // Native ROSE token
	},
};

// Oasis Sapphire Testnet details
export const SAPPHIRE_TESTNET = {
	RPC_URL: "https://testnet.sapphire.oasis.dev",
	CHAIN_ID: 0x5aff,
	EXPLORER_URL: "https://explorer.oasis.io/testnet/sapphire",
	CONTRACTS: {
		// UNSTAKE: "", // Removed - Not used in current implementation
		WRAPPED_ROSE: "", // TODO: Replace with testnet address when available
		UNWRAPPED_ROSE: "", // TODO: Replace with testnet address when available
	},
};

// Standard ERC20 ABI for token operations
export const ERC20_ABI = [
	{
		constant: true,
		inputs: [{ name: "_owner", type: "address" }],
		name: "balanceOf",
		outputs: [{ name: "balance", type: "uint256" }],
		type: "function",
	},
	{
		constant: false,
		inputs: [
			{ name: "_to", type: "address" },
			{ name: "_value", type: "uint256" },
		],
		name: "transfer",
		outputs: [{ name: "", type: "bool" }],
		type: "function",
	},
	{
		constant: false,
		inputs: [
			{ name: "_spender", type: "address" },
			{ name: "_value", type: "uint256" },
		],
		name: "approve",
		outputs: [{ name: "", type: "bool" }],
		type: "function",
	},
	{
		constant: true,
		inputs: [],
		name: "decimals",
		outputs: [{ name: "", type: "uint8" }],
		type: "function",
	},
	{
		constant: true,
		inputs: [],
		name: "totalSupply",
		outputs: [{ name: "", type: "uint256" }],
		type: "function",
	},
	{
		constant: true,
		inputs: [
			{ name: "_owner", type: "address" },
			{ name: "_spender", type: "address" },
		],
		name: "allowance",
		outputs: [{ name: "", type: "uint256" }],
		type: "function",
	},
	{
		constant: false,
		inputs: [
			{ name: "owner", type: "address" },
			{ name: "spender", type: "address" },
			{ name: "value", type: "uint256" },
			{ name: "deadline", type: "uint256" },
			{ name: "v", type: "uint8" },
			{ name: "r", type: "bytes32" },
			{ name: "s", type: "bytes32" },
		],
		name: "permit",
		outputs: [],
		type: "function",
	},
];

// wstROSE contract ABI based on the contract source code
export const WSTROSE_ABI = [
	// ERC4626 Functions
	{
		inputs: [
			{ name: "assets", type: "uint256" },
			{ name: "receiver", type: "address" },
		],
		name: "deposit",
		outputs: [{ name: "shares", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "shares", type: "uint256" },
			{ name: "receiver", type: "address" },
		],
		name: "mint",
		outputs: [{ name: "assets", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "assets", type: "uint256" },
			{ name: "receiver", type: "address" },
			{ name: "owner", type: "address" },
		],
		name: "withdraw",
		outputs: [{ name: "shares", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "shares", type: "uint256" },
			{ name: "receiver", type: "address" },
			{ name: "owner", type: "address" },
		],
		name: "redeem",
		outputs: [{ name: "assets", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "totalAssets",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "pricePerShare",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "assets", type: "uint256" }],
		name: "convertToShares",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "shares", type: "uint256" }],
		name: "convertToAssets",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "assets", type: "uint256" }],
		name: "previewDeposit",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "shares", type: "uint256" }],
		name: "previewMint",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "assets", type: "uint256" }],
		name: "previewWithdraw",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "shares", type: "uint256" }],
		name: "previewRedeem",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "owner", type: "address" }],
		name: "maxWithdraw",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "owner", type: "address" }],
		name: "maxRedeem",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "syncRewards",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "assets", type: "uint256" },
			{ name: "receiver", type: "address" },
			{ name: "deadline", type: "uint256" },
			{ name: "approveMax", type: "bool" },
			{ name: "v", type: "uint8" },
			{ name: "r", type: "bytes32" },
			{ name: "s", type: "bytes32" },
		],
		name: "depositWithSignature",
		outputs: [{ name: "shares", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "asset",
		outputs: [{ name: "", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
];

// Combined ABIs for easy access
export const ABIS = {
	WSTROSE: WSTROSE_ABI,
	ERC20: ERC20_ABI,
}; 