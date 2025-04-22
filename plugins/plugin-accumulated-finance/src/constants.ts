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
	{
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "max",
				type: "uint256",
			},
		],
		name: "ExceededMaxDeposit",
		type: "error",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "max",
				type: "uint256",
			},
		],
		name: "ExceededMaxMint",
		type: "error",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "max",
				type: "uint256",
			},
		],
		name: "ExceededMaxRedeem",
		type: "error",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "max",
				type: "uint256",
			},
		],
		name: "ExceededMaxWithdraw",
		type: "error",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "owner",
				type: "address",
			},
			{
				indexed: true,
				internalType: "address",
				name: "spender",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "Approval",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "caller",
				type: "address",
			},
			{
				indexed: true,
				internalType: "address",
				name: "owner",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
		],
		name: "Deposit",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "from",
				type: "address",
			},
			{
				indexed: true,
				internalType: "address",
				name: "to",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "Transfer",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "caller",
				type: "address",
			},
			{
				indexed: true,
				internalType: "address",
				name: "receiver",
				type: "address",
			},
			{
				indexed: true,
				internalType: "address",
				name: "owner",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
		],
		name: "Withdraw",
		type: "event",
	},
	{
		inputs: [],
		name: "DOMAIN_SEPARATOR",
		outputs: [
			{
				internalType: "bytes32",
				name: "",
				type: "bytes32",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		name: "allowance",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "spender",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "approve",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "asset",
		outputs: [
			{
				internalType: "contract ERC20",
				name: "",
				type: "address",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		name: "balanceOf",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
		],
		name: "convertToAssets",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
		],
		name: "convertToShares",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "decimals",
		outputs: [
			{
				internalType: "uint8",
				name: "",
				type: "uint8",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
			{
				internalType: "address",
				name: "receiver",
				type: "address",
			},
		],
		name: "deposit",
		outputs: [
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		name: "maxDeposit",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		name: "maxMint",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address",
			},
		],
		name: "maxRedeem",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address",
			},
		],
		name: "maxWithdraw",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
			{
				internalType: "address",
				name: "receiver",
				type: "address",
			},
		],
		name: "mint",
		outputs: [
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "name",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		name: "nonces",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address",
			},
			{
				internalType: "address",
				name: "spender",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "value",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "deadline",
				type: "uint256",
			},
			{
				internalType: "uint8",
				name: "v",
				type: "uint8",
			},
			{
				internalType: "bytes32",
				name: "r",
				type: "bytes32",
			},
			{
				internalType: "bytes32",
				name: "s",
				type: "bytes32",
			},
		],
		name: "permit",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
		],
		name: "previewDeposit",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
		],
		name: "previewMint",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
		],
		name: "previewRedeem",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
		],
		name: "previewWithdraw",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
			{
				internalType: "address",
				name: "receiver",
				type: "address",
			},
			{
				internalType: "address",
				name: "owner",
				type: "address",
			},
		],
		name: "redeem",
		outputs: [
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "symbol",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "totalAssets",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "totalSupply",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "to",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "transfer",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address",
			},
			{
				internalType: "address",
				name: "to",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "transferFrom",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
			{
				internalType: "address",
				name: "receiver",
				type: "address",
			},
			{
				internalType: "address",
				name: "owner",
				type: "address",
			},
		],
		name: "withdraw",
		outputs: [
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
];

// Combined ABIs for easy access
export const ABIS = {
	WSTROSE: WSTROSE_ABI,
	ERC20: ERC20_ABI,
}; 