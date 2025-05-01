import { ethers } from "ethers";

// Privacy level type
export type PrivacyLevel = "low" | "medium" | "high";

// Default privacy level
export const DEFAULT_PRIVACY_LEVEL: PrivacyLevel = "high";

// Type for swap content in the generated objects
export interface SwapContent {
	fromToken: string;
	toToken: string;
	amount: string;
	slippage: number;
	privacyLevel: PrivacyLevel;
}

// Schema for SwapContent validation
export const SwapSchema = {
	type: "object",
	properties: {
		fromToken: { type: "string" },
		toToken: { type: "string" },
		amount: { type: "string" },
		slippage: { type: "number" },
		privacyLevel: { type: "string", enum: ["low", "medium", "high"] },
	},
	required: ["fromToken", "toToken", "amount"],
	additionalProperties: false,
};

// Type guard for SwapContent
export function isSwapContent(obj: any): obj is SwapContent {
	return (
		obj &&
		typeof obj === "object" &&
		typeof obj.fromToken === "string" &&
		typeof obj.toToken === "string" &&
		typeof obj.amount === "string" &&
		(obj.slippage === undefined || typeof obj.slippage === "number") &&
		(obj.privacyLevel === undefined ||
			(typeof obj.privacyLevel === "string" &&
				["low", "medium", "high"].includes(obj.privacyLevel)))
	);
}

// ABIs for Thorn Protocol contracts
export const ABIS = {
	STABLE_SWAP_ROUTER: [
		{
			inputs: [
				{
					internalType: "address",
					name: "_stableSwapFactory",
					type: "address",
				},
				{
					internalType: "address",
					name: "_stableSwapInfo",
					type: "address",
				},
			],
			stateMutability: "nonpayable",
			type: "constructor",
		},
		{
			anonymous: false,
			inputs: [
				{
					indexed: true,
					internalType: "address",
					name: "previousOwner",
					type: "address",
				},
				{
					indexed: true,
					internalType: "address",
					name: "newOwner",
					type: "address",
				},
			],
			name: "OwnershipTransferred",
			type: "event",
		},
		{
			anonymous: false,
			inputs: [
				{
					indexed: true,
					internalType: "address",
					name: "factory",
					type: "address",
				},
				{
					indexed: true,
					internalType: "address",
					name: "info",
					type: "address",
				},
			],
			name: "SetStableSwap",
			type: "event",
		},
		{
			anonymous: false,
			inputs: [
				{
					indexed: true,
					internalType: "address",
					name: "buyer",
					type: "address",
				},
				{
					indexed: false,
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
				{
					indexed: true,
					internalType: "address",
					name: "token1",
					type: "address",
				},
				{
					indexed: false,
					internalType: "uint256",
					name: "amountOut",
					type: "uint256",
				},
				{
					indexed: true,
					internalType: "address",
					name: "token2",
					type: "address",
				},
				{
					indexed: false,
					internalType: "address",
					name: "recipient",
					type: "address",
				},
			],
			name: "StableExchange",
			type: "event",
		},
		{
			inputs: [],
			name: "ROSE",
			outputs: [
				{
					internalType: "address",
					name: "",
					type: "address",
				},
			],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [],
			name: "WROSE",
			outputs: [
				{
					internalType: "address",
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
					internalType: "address[]",
					name: "path",
					type: "address[]",
				},
				{
					internalType: "uint256[]",
					name: "flag",
					type: "uint256[]",
				},
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "amountOutMin",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "to",
					type: "address",
				},
			],
			name: "exactInputStableSwap",
			outputs: [
				{
					internalType: "uint256",
					name: "amountOut",
					type: "uint256",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address[]",
					name: "path",
					type: "address[]",
				},
				{
					internalType: "uint256[]",
					name: "flag",
					type: "uint256[]",
				},
				{
					internalType: "uint256",
					name: "amountOut",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "amountInMax",
					type: "uint256",
				},
			],
			name: "getInputStableSwap",
			outputs: [
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
			],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address[]",
					name: "path",
					type: "address[]",
				},
				{
					internalType: "uint256[]",
					name: "flag",
					type: "uint256[]",
				},
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "amountOutMin",
					type: "uint256",
				},
			],
			name: "getOutputStableSwap",
			outputs: [
				{
					internalType: "uint256",
					name: "amountOut",
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
					name: "tokenA",
					type: "address",
				},
				{
					internalType: "address",
					name: "tokenB",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
			],
			name: "getAmountsOut",
			outputs: [
				{
					internalType: "uint256[]",
					name: "amounts",
					type: "uint256[]",
				},
			],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [],
			name: "getAllPools",
			outputs: [
				{
					components: [
						{ name: "id", type: "string" },
						{ name: "token0", type: "address" },
						{ name: "token1", type: "address" },
						{ name: "reserve0", type: "uint256" },
						{ name: "reserve1", type: "uint256" },
						{ name: "fee", type: "uint256" },
						{ name: "address", type: "address" },
						{ name: "factory", type: "address" },
					],
					name: "pools",
					type: "tuple[]",
				},
			],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "tokenA",
					type: "address",
				},
				{
					internalType: "address",
					name: "tokenB",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "amountOutMin",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "to",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "deadline",
					type: "uint256",
				},
				{
					internalType: "uint8",
					name: "privacyLevel",
					type: "uint8",
				},
			],
			name: "swapExactTokensForTokens",
			outputs: [
				{
					internalType: "uint256",
					name: "amountOut",
					type: "uint256",
				},
			],
			stateMutability: "nonpayable",
			type: "function",
		},
	],
	STABLE_SWAP_INFO: [
		{
			inputs: [
				{
					internalType: "contract IStableSwapInfo",
					name: "_twoPoolInfo",
					type: "address",
				},
				{
					internalType: "contract IStableSwapInfo",
					name: "_threePoolInfo",
					type: "address",
				},
			],
			stateMutability: "nonpayable",
			type: "constructor",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "_swap",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "i",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "j",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "dy",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "max_dx",
					type: "uint256",
				},
			],
			name: "get_dx",
			outputs: [
				{
					internalType: "uint256",
					name: "dx",
					type: "uint256",
				},
			],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [],
			name: "threePoolInfo",
			outputs: [
				{
					internalType: "contract IStableSwapInfo",
					name: "",
					type: "address",
				},
			],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [],
			name: "twoPoolInfo",
			outputs: [
				{
					internalType: "contract IStableSwapInfo",
					name: "",
					type: "address",
				},
			],
			stateMutability: "view",
			type: "function",
		},
	],
	STABLE_SWAP_FACTORY: [
		{
			inputs: [
				{
					internalType: "address",
					name: "implementationAddress",
					type: "address",
				},
				{
					internalType: "address",
					name: "ownerAddress",
					type: "address",
				},
				{
					internalType: "bytes",
					name: "data",
					type: "bytes",
				},
			],
			stateMutability: "payable",
			type: "constructor",
		},
		{
			anonymous: false,
			inputs: [
				{
					indexed: true,
					internalType: "address",
					name: "previousOwner",
					type: "address",
				},
				{
					indexed: true,
					internalType: "address",
					name: "newOwner",
					type: "address",
				},
			],
			name: "OwnershipTransferred",
			type: "event",
		},
		{
			anonymous: false,
			inputs: [
				{
					indexed: true,
					internalType: "address",
					name: "previousImplementation",
					type: "address",
				},
				{
					indexed: true,
					internalType: "address",
					name: "newImplementation",
					type: "address",
				},
			],
			name: "ProxyImplementationUpdated",
			type: "event",
		},
		{
			stateMutability: "payable",
			type: "fallback",
		},
		{
			inputs: [],
			name: "owner",
			outputs: [
				{
					internalType: "address",
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
					internalType: "bytes4",
					name: "id",
					type: "bytes4",
				},
			],
			name: "supportsInterface",
			outputs: [
				{
					internalType: "bool",
					name: "",
					type: "bool",
				},
			],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "newOwner",
					type: "address",
				},
			],
			name: "transferOwnership",
			outputs: [],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "newImplementation",
					type: "address",
				},
			],
			name: "upgradeTo",
			outputs: [],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "newImplementation",
					type: "address",
				},
				{
					internalType: "bytes",
					name: "data",
					type: "bytes",
				},
			],
			name: "upgradeToAndCall",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			stateMutability: "payable",
			type: "receive",
		},
	],
	STRATEGY_FACTORY: [
		{
			inputs: [
				{ internalType: "string", name: "name", type: "string" },
				{ internalType: "address", name: "targetToken", type: "address" },
				{ internalType: "address[]", name: "sourceTokens", type: "address[]" },
				{ internalType: "uint256", name: "budget", type: "uint256" },
				{ internalType: "uint256", name: "maxSlippage", type: "uint256" },
				{ internalType: "uint256", name: "triggerThreshold", type: "uint256" },
				{ internalType: "bool", name: "isActive", type: "bool" },
				{ internalType: "uint256", name: "timeBetweenTrades", type: "uint256" },
			],
			name: "createStrategy",
			outputs: [{ internalType: "address", name: "", type: "address" }],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [{ internalType: "address", name: "user", type: "address" }],
			name: "getUserStrategyCount",
			outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [
				{ internalType: "address", name: "user", type: "address" },
				{ internalType: "uint256", name: "index", type: "uint256" },
			],
			name: "userStrategies",
			outputs: [{ internalType: "address", name: "", type: "address" }],
			stateMutability: "view",
			type: "function",
		},
	],
	STRATEGY_CONTRACT: [
		{
			inputs: [],
			name: "getStrategyDetails",
			outputs: [
				{ internalType: "string", name: "name", type: "string" },
				{ internalType: "address", name: "targetToken", type: "address" },
				{ internalType: "address[]", name: "sourceTokens", type: "address[]" },
				{ internalType: "uint256", name: "budget", type: "uint256" },
				{ internalType: "uint256", name: "maxSlippage", type: "uint256" },
				{ internalType: "uint256", name: "triggerThreshold", type: "uint256" },
				{ internalType: "bool", name: "isActive", type: "bool" },
				{ internalType: "uint256", name: "nextExecutionTime", type: "uint256" },
				{ internalType: "uint256", name: "executionCount", type: "uint256" },
				{ internalType: "address", name: "owner", type: "address" },
			],
			stateMutability: "view",
			type: "function",
		},
	],
};

// Oasis Network constants
export const OASIS_NETWORKS = {
	MAINNET: "mainnet",
	TESTNET: "testnet",
};

export const OASIS_NETWORK_IDS = {
	MAINNET: "42262",
	TESTNET: "42261",
};

export const OASIS_RPC_URLS = {
	MAINNET: "https://sapphire.oasis.io",
	TESTNET: "https://testnet.sapphire.oasis.io",
};

// Thorn Protocol constants
export const THORN_DEFAULT_API_URL = "https://api.thornprotocol.com";
export const THORN_DEFAULT_MAX_SLIPPAGE = 0.5;
export const THORN_DEFAULT_MIN_LIQUIDITY = "1000";
export const THORN_DEFAULT_PRIVACY_LEVEL = "high";

// CSV file paths
export const SWAP_CSV_FILE_PATH = "/tmp/thorn_swaps.csv";
export const PRICE_MONITOR_CSV_FILE_PATH = "/tmp/thorn_price_monitoring.csv";
export const STRATEGY_CSV_FILE_PATH = "/tmp/thorn_strategies.csv";

// Default gas configuration
export const DEFAULT_GAS_LIMIT = 250000;
export const DEFAULT_GAS_PRICE = ethers.parseUnits("10", "gwei").toString();

// Thorn Protocol Core Infrastructure Contracts
export const THORN_CONTRACTS = {
	MAINNET: {
		STABLE_SWAP_FACTORY: "0x5d41EA151C5929F3DCe8d392AB976E2960B4E5D6",
		STABLE_SWAP_ROUTER: "0xEf1A6269D0Cb79096F6C596A352D6e3E12c26db8",
		STABLE_SWAP_INFO: "0xf669F70fFd79a20A9622a6C2c7f13C2F3Bd5595D",
		SMART_ROUTER_HELPER: "0x5cAD84695d142B7F8Ad12C37164D3dE1B2eB3DD8",
		STRATEGY_FACTORY: "0x4D73A4771352Ec383Bb9A94C8F67bB76b47F9bD5",
	},
	TESTNET: {
		STABLE_SWAP_FACTORY: "0x00cEAaE12A697E96de86e97497C4337C39e558eB",
		STABLE_SWAP_ROUTER: "0x6BF1e398e7D638BBBC32576D9C3703CE5A4c1B8C",
		STABLE_SWAP_INFO: "0xfAA0FA42d4E2e5B12BD0114298A3CBF1B582117B",
		SMART_ROUTER_HELPER: "0x20a6bDAc661367e8e2fb36ac50431d8A5cB39929",
		STRATEGY_FACTORY: "0x58D594BB0B8d0755A8A42Fe2c4434C84C61a2d0e",
	},
};

// Token addresses on Oasis (testnet examples)
export const TOKEN_ADDRESSES = {
	TESTNET: {
		USDC: "0x94Fa70C3fB789BBE62D8698Bc9EbE4F7BD04CF6A",
		USDT: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06",
		DAI: "0x4A4753eAF2bEF9FF8c324D2A9D1927e453757e7C",
		BUSD: "0x5b0AbE890f0d8F0d03325865f7dA55c7E0472608",
		FRAX: "0xDdb3A837C3267Fb39aa271731eD4D169B1A79832",
	},
	MAINNET: {
		USDC: "0xE8A638b3B7565Ee7c5EB9755E58D056DE3f93749",
		USDT: "0x6A2d262D56735DbA19Dd70682B39F6bE9a931D98",
		DAI: "0x4FA43149879aF6903c7AC904F73Dc6737eAe5D3c",
		BUSD: "0x7B4284b0A08dAE922B3A81Ee1C5dD5024CF4538c",
		FRAX: "0x17A8541B82BF67e10B0874284b4Ae66858cb1fd5",
	},
};

// Privacy level mapping
export const PRIVACY_LEVEL_VALUES = {
	low: 1,
	medium: 2,
	high: 3,
};
