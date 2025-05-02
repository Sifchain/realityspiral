import { ethers } from "ethers";

// Type for swap content in the generated objects
export interface SwapContent {
	fromToken: string;
	toToken: string;
	amount: string;
	slippage: number;
}

// Schema for SwapContent validation
export const SwapSchema = {
	type: "object",
	properties: {
		fromToken: { type: "string" },
		toToken: { type: "string" },
		amount: { type: "string" },
		slippage: { type: "number" },
	},
	required: ["fromToken", "toToken", "amount"],
	additionalProperties: false,
};

// Type guard for SwapContent
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function isSwapContent(obj: any): obj is SwapContent {
	return (
		obj &&
		typeof obj === "object" &&
		typeof obj.fromToken === "string" &&
		typeof obj.toToken === "string" &&
		typeof obj.amount === "string" &&
		(obj.slippage === undefined || typeof obj.slippage === "number")
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
	MAINNET: "23294",
	TESTNET: "23295",
};

export const OASIS_RPC_URLS = {
	MAINNET: "https://sapphire.oasis.io",
	TESTNET: "https://testnet.sapphire.oasis.io",
};

// Thorn Protocol constants
export const THORN_DEFAULT_API_URL = "https://api.thornprotocol.com";
export const THORN_DEFAULT_MAX_SLIPPAGE = 0.5;
export const THORN_DEFAULT_MIN_LIQUIDITY = "1000";

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
		STABLE_SWAP_FACTORY: "0x888099De8EA8068D92bB04b47A743B82195c4aD2",
		STABLE_SWAP_ROUTER: "0xbfdcE45a9241870E7cF338BAaa3185972A550922",
		STABLE_SWAP_INFO: "0xe50516bCC168B67b5391e15E877c6a4cc3e75f00",
		SMART_ROUTER_HELPER: "0x68968cdE2fe5b61cEC87Ae6fdCB2fc39271893c2",
		STRATEGY_FACTORY: "", // TBD: Add Oasis mainnet address
	},
	TESTNET: {
		STABLE_SWAP_FACTORY: "",
		STABLE_SWAP_ROUTER: "",
		STABLE_SWAP_INFO: "",
		SMART_ROUTER_HELPER: "",
		STRATEGY_FACTORY: "",
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

export const TESTNET_TOKEN_ADDRESSES = {
	ROSE: {
		address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
		decimals: 18,
		isNativeToken: true,
		img: "https://coin-images.coingecko.com/coins/images/13162/large/OASIS.jpg",
	},
} as const;

export const MAINNET_TOKEN_ADDRESSES = {
	ROSE: {
		address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
		decimals: 18,
		isNativeToken: true,
		img: "https://coin-images.coingecko.com/coins/images/13162/large/OASIS.jpg",
	},
	stROSE: {
		address: "0xEd57966f1566dE1a90042d07403021Ea52ad4724",
		decimals: 18,
		isNativeToken: false,
		img: "https://coin-images.coingecko.com/coins/images/51115/large/strose.png",
	},
	USDC: {
		address: "0x97eec1c29f745dC7c267F90292AA663d997a601D",
		decimals: 6,
		isNativeToken: false,
		img: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
	},
	bitUSDs: {
		address: "0xA14167756d9F86Aed12b472C29B257BBdD9974C2",
		decimals: 18,
		isNativeToken: false,
		img: "https://i.postimg.cc/Ghn9TW8Z/Je4-N9i-S-400x400.jpg",
	},
	USDT: {
		address: "0x8C4aCd74Ff4385f3B7911432FA6787Aa14406f8B",
		decimals: 6,
		isNativeToken: false,
		img: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
	},
	"OCEAN(Router)": {
		address: "0x2F301d3b045544A9D7Ec3FA090CD78986F11f2E7",
		decimals: 18,
		isNativeToken: false,
		img: "https://assets.coingecko.com/coins/images/3687/standard/ocean-protocol-logo.jpg",
	},
	"OCEAN(Celer)": {
		address: "0x39d22B78A7651A76Ffbde2aaAB5FD92666Aca520",
		decimals: 18,
		isNativeToken: false,
		img: "https://assets.coingecko.com/coins/images/3687/standard/ocean-protocol-logo.jpg",
	},
} as const;

export const LP_ADDRESSES = {
	"ROSE/stROSE": {
		address: "0xd6fDdb88bB0f1317310E152A1065dCF2B6cdB0D2",
		decimals: 18,
	},
	"bitUSDs/USDC": {
		address: "0x274186AA4Ad57eA887C5c12aC2aa5738d8254DE4",
		decimals: 18,
	},
	"bitUSD/USDT": {
		address: "0x4Fc812116776704056cBBa3E56a8c1935693b946",
		decimals: 18,
	},
	"OCEAN/OCEAN": {
		address: "0x1F33221947A0D98A6dCF689339137770420eE2e3",
		decimals: 18,
	},
} as const;

export const POOL_ADDRESSES = {
	"ROSE-stROSE": "0x52B0F01751a4fa76B6C847081cD7C1dcC34FF877",
	"bitUSDs-USDC": "0x4937cC76D5fb3040D3d146149B64a646f05cA8EC",
	"bitUSDs-USDT": "0xc3999e264fF94cbE99A8464CbcF7Cdc45EE7aE07",
	"OCEAN(Router)-OCEAN(Celer)": "0xb13BDf649a954aE62B8c91125949657f1ce5CA71",
} as const;
