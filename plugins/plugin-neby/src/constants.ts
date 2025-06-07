// Oasis Sapphire Mainnet details
export const SAPPHIRE_MAINNET = {
	RPC_URL: "https://sapphire.oasis.io",
	CHAIN_ID: 0x5afe,
	EXPLORER_URL: "https://explorer.oasis.io/mainnet/sapphire",
	CONTRACTS: {
		V3_CORE_FACTORY: "0x218D71cd52363B7A47cD31549f3b9031d74A585A",
		MULTICALL: "0x05568F4E3e4F0c3E7b8664e302f269574fEAD13A",
		QUOTER: "0xA7A00B2493F362B5232337398C0eC6052165464c",
		NFT_POSITION_MANAGER: "0x2D69C85166B8B84916EF49FF20f287f9Eb6381fe",
		TICK_LENS: "0x96488E235627Fd7A5a82B555dbbfd1F0d268C757",
		SWAP_ROUTER_02: "0x6Dd410DbF04b2C197353CD981eCC374906eB62F6",
		HARVESTER: "0xE310Bce86F2ff352C091e2257943bfd0923cb1Df",
		LIQUIDITY_POSITION_STAKER: "0x7A0D1E8AE82E163bAdBF7bd563111F3b05F07c46",
		NEBY_STAKER: "0x269Ddf6666BA65dAa32ca526fa1F14D9aC7dD3b4",
		UNIVERSAL_ROUTER: "0xd099ef034EaAbFb7db7334B9b3E8a0dA4d50949a",
		PERMIT2: "0xA3dF2613A995693E81a6e3a8Ea3fcB770c5fF800",
	},
	// Common token addresses
	TOKENS: {
		ROSE: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native ROSE token
		wROSE: "0x8Bc2B030b299964eEfb5e1e0b36991352E56D2D3", // Celer-bridged wROSE
		wstROSE: "0x3cAbbe76Ea8B4e7a2c0a69812CBe671800379eC8", // wstROSE
		USDC: "0x97eec1c29f745dC7c267F90292AA663d997a601D", // USDC stablecoin on Sapphire
		WETH: "0xB6dc6C8b71e88642cEAD3be1025565A9eE74d1C6", // Wrapped ETH on Sapphire (Celer-bridged)
	},
};

// Oasis Sapphire Testnet details
export const SAPPHIRE_TESTNET = {
	RPC_URL: "https://testnet.sapphire.oasis.dev",
	CHAIN_ID: 0x5aff,
	EXPLORER_URL: "https://explorer.oasis.io/testnet/sapphire",
	CONTRACTS: {
		V3_CORE_FACTORY: "0x7E464E5471a9282B5C81E4c3a9B7680Dd908D1C2", // Testnet factory
		MULTICALL: "0x3C6D2F223677B5388B6d9e8C807be6245c9B6A51", // Testnet multicall
		QUOTER: "0x9B3dC97dFCB50F1a1C68B9561279e9B2C7fdE941", // Testnet quoter
		NFT_POSITION_MANAGER: "0x1570235B38E62E35248A4C5D50751C29196F95AB", // Testnet position manager
		TICK_LENS: "0x0F7769F08CCe5054369182f57E70795d18931A0F", // Testnet tick lens
		SWAP_ROUTER_02: "0x5dbFD9d19c81021b6dbCb8766d853C7bB761a957", // Testnet router
		HARVESTER: "0xd37FFa87A7b0e2b2678287A7B1B47f76E56D7e37", // Testnet harvester
		LIQUIDITY_POSITION_STAKER: "0x6E5842a5A25f36c95a7C1246C052F4912378FF26", // Testnet position staker
		NEBY_STAKER: "0x9C0ccEC208a619312f4CeB5f4B578c3bE4724A33", // Testnet staker
		UNIVERSAL_ROUTER: "0x5D65C5c6936e8dAE9DB84443ED3Bf4727C9e4dD9", // Testnet universal router
		PERMIT2: "0x93dDB2453b6F4925D772301BB3D0da63CB8D41FE", // Testnet permit2
	},
	TOKENS: {
		ROSE: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native ROSE token
		wROSE: "0x84DA87ffd41Abe5c95C8943f2259C986371DFE16", // Testnet wrapped ROSE
		USDC: "0x3b00685d919C515A7BC2A6909a85e877cD217Cd1", // Testnet USDC - CORRECTED CHECKSUM V2
	},
};

// Common pool fees (in basis points)
export const POOL_FEES = {
	LOWEST: 100, // 0.01%
	LOW: 500, // 0.05%
	MEDIUM: 3000, // 0.3%
	HIGH: 10000, // 1%
};

// Default gas prices
export const GAS_PRICES = {
	LOW: 50,
	MEDIUM: 100,
	HIGH: 200,
};

// Network Constants
export const SUPPORTED_NETWORKS = [
	"ethereum",
	"arbitrum",
	"optimism",
	"polygon",
	"base",
];

// Contract Constants
export const V3_CORE_FACTORY_ADDRESS =
	"0x1F98431c8aD98523631AE4a59f267346ea31F984";
export const V3_QUOTER_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

// Common token addresses
export const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Ethereum Mainnet WETH
export const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Ethereum Mainnet USDC

// ABIs
export const UNISWAP_V3_POOL_ABI = [
	// Only including the necessary methods for price calculation
	"function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
	"function token0() external view returns (address)",
	"function token1() external view returns (address)",
	"function fee() external view returns (uint24)",
	"function liquidity() external view returns (uint128)",
];

export const UNISWAP_V3_QUOTER_ABI = [
	"function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
	"function quoteExactOutputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountOut, uint160 sqrtPriceLimitX96) external returns (uint256 amountIn)",
];

export const ERC20_ABI = [
	"function name() view returns (string)",
	"function symbol() view returns (string)",
	"function decimals() view returns (uint8)",
	"function balanceOf(address) view returns (uint)",
	"function totalSupply() view returns (uint)",
	"function allowance(address owner, address spender) view returns (uint)",
	"function approve(address spender, uint value) returns (bool)",
	"function transfer(address to, uint value) returns (bool)",
	"function transferFrom(address from, address to, uint value) returns (bool)",
];

// Action types
export const ACTION_TYPES = {
	SWAP: "SWAP_NEBY",
	ADD_LIQUIDITY: "ADD_LIQUIDITY_NEBY",
	REMOVE_LIQUIDITY: "REMOVE_LIQUIDITY_NEBY",
	GET_PRICE: "GET_PRICE_NEBY",
	FIND_ARBITRAGE: "FIND_ARBITRAGE_NEBY",
	GET_POOL_INFO: "GET_POOL_INFO_NEBY",
};

// ABIs for Neby contracts
export const ABIS = {
	// ERC20 token standard ABI
	ERC20: [
		{
			inputs: [
				{
					internalType: "address",
					name: "spender",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "allowance",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "needed",
					type: "uint256",
				},
			],
			name: "ERC20InsufficientAllowance",
			type: "error",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "sender",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "balance",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "needed",
					type: "uint256",
				},
			],
			name: "ERC20InsufficientBalance",
			type: "error",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "approver",
					type: "address",
				},
			],
			name: "ERC20InvalidApprover",
			type: "error",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "receiver",
					type: "address",
				},
			],
			name: "ERC20InvalidReceiver",
			type: "error",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "sender",
					type: "address",
				},
			],
			name: "ERC20InvalidSender",
			type: "error",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "spender",
					type: "address",
				},
			],
			name: "ERC20InvalidSpender",
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
					name: "value",
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
					name: "value",
					type: "uint256",
				},
			],
			name: "Transfer",
			type: "event",
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
					name: "value",
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
			inputs: [
				{
					internalType: "address",
					name: "account",
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
					name: "value",
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
					name: "value",
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
	],

	// Quoter contract ABI for price quotes
	QUOTER: [
		{
			inputs: [
				{
					internalType: "address",
					name: "_factory",
					type: "address",
				},
				{
					internalType: "address",
					name: "_WETH9",
					type: "address",
				},
			],
			stateMutability: "nonpayable",
			type: "constructor",
		},
		{
			inputs: [],
			name: "WETH9",
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
			name: "factory",
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
					internalType: "bytes",
					name: "path",
					type: "bytes",
				},
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
			],
			name: "quoteExactInput",
			outputs: [
				{
					internalType: "uint256",
					name: "amountOut",
					type: "uint256",
				},
				{
					internalType: "uint160[]",
					name: "sqrtPriceX96AfterList",
					type: "uint160[]",
				},
				{
					internalType: "uint32[]",
					name: "initializedTicksCrossedList",
					type: "uint32[]",
				},
				{
					internalType: "uint256",
					name: "gasEstimate",
					type: "uint256",
				},
			],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [
				{
					components: [
						{
							internalType: "address",
							name: "tokenIn",
							type: "address",
						},
						{
							internalType: "address",
							name: "tokenOut",
							type: "address",
						},
						{
							internalType: "uint256",
							name: "amountIn",
							type: "uint256",
						},
						{
							internalType: "uint24",
							name: "fee",
							type: "uint24",
						},
						{
							internalType: "uint160",
							name: "sqrtPriceLimitX96",
							type: "uint160",
						},
					],
					internalType: "struct IQuoterV2.QuoteExactInputSingleParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "quoteExactInputSingle",
			outputs: [
				{
					internalType: "uint256",
					name: "amountOut",
					type: "uint256",
				},
				{
					internalType: "uint160",
					name: "sqrtPriceX96After",
					type: "uint160",
				},
				{
					internalType: "uint32",
					name: "initializedTicksCrossed",
					type: "uint32",
				},
				{
					internalType: "uint256",
					name: "gasEstimate",
					type: "uint256",
				},
			],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "bytes",
					name: "path",
					type: "bytes",
				},
				{
					internalType: "uint256",
					name: "amountOut",
					type: "uint256",
				},
			],
			name: "quoteExactOutput",
			outputs: [
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
				{
					internalType: "uint160[]",
					name: "sqrtPriceX96AfterList",
					type: "uint160[]",
				},
				{
					internalType: "uint32[]",
					name: "initializedTicksCrossedList",
					type: "uint32[]",
				},
				{
					internalType: "uint256",
					name: "gasEstimate",
					type: "uint256",
				},
			],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [
				{
					components: [
						{
							internalType: "address",
							name: "tokenIn",
							type: "address",
						},
						{
							internalType: "address",
							name: "tokenOut",
							type: "address",
						},
						{
							internalType: "uint256",
							name: "amount",
							type: "uint256",
						},
						{
							internalType: "uint24",
							name: "fee",
							type: "uint24",
						},
						{
							internalType: "uint160",
							name: "sqrtPriceLimitX96",
							type: "uint160",
						},
					],
					internalType: "struct IQuoterV2.QuoteExactOutputSingleParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "quoteExactOutputSingle",
			outputs: [
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
				{
					internalType: "uint160",
					name: "sqrtPriceX96After",
					type: "uint160",
				},
				{
					internalType: "uint32",
					name: "initializedTicksCrossed",
					type: "uint32",
				},
				{
					internalType: "uint256",
					name: "gasEstimate",
					type: "uint256",
				},
			],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "int256",
					name: "amount0Delta",
					type: "int256",
				},
				{
					internalType: "int256",
					name: "amount1Delta",
					type: "int256",
				},
				{
					internalType: "bytes",
					name: "path",
					type: "bytes",
				},
			],
			name: "uniswapV3SwapCallback",
			outputs: [],
			stateMutability: "view",
			type: "function",
		},
	],

	// SwapRouter02 ABI for executing swaps
	SWAP_ROUTER: [
		{
			inputs: [
				{
					internalType: "address",
					name: "_factoryV2",
					type: "address",
				},
				{
					internalType: "address",
					name: "factoryV3",
					type: "address",
				},
				{
					internalType: "address",
					name: "_positionManager",
					type: "address",
				},
				{
					internalType: "address",
					name: "_WETH9",
					type: "address",
				},
			],
			stateMutability: "nonpayable",
			type: "constructor",
		},
		{
			inputs: [],
			name: "WETH9",
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
					internalType: "address",
					name: "token",
					type: "address",
				},
			],
			name: "approveMax",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
					type: "address",
				},
			],
			name: "approveMaxMinusOne",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
					type: "address",
				},
			],
			name: "approveZeroThenMax",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
					type: "address",
				},
			],
			name: "approveZeroThenMaxMinusOne",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "bytes",
					name: "data",
					type: "bytes",
				},
			],
			name: "callPositionManager",
			outputs: [
				{
					internalType: "bytes",
					name: "result",
					type: "bytes",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "bytes[]",
					name: "paths",
					type: "bytes[]",
				},
				{
					internalType: "uint128[]",
					name: "amounts",
					type: "uint128[]",
				},
				{
					internalType: "uint24",
					name: "maximumTickDivergence",
					type: "uint24",
				},
				{
					internalType: "uint32",
					name: "secondsAgo",
					type: "uint32",
				},
			],
			name: "checkOracleSlippage",
			outputs: [],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "bytes",
					name: "path",
					type: "bytes",
				},
				{
					internalType: "uint24",
					name: "maximumTickDivergence",
					type: "uint24",
				},
				{
					internalType: "uint32",
					name: "secondsAgo",
					type: "uint32",
				},
			],
			name: "checkOracleSlippage",
			outputs: [],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [
				{
					components: [
						{
							internalType: "bytes",
							name: "path",
							type: "bytes",
						},
						{
							internalType: "address",
							name: "recipient",
							type: "address",
						},
						{
							internalType: "uint256",
							name: "amountIn",
							type: "uint256",
						},
						{
							internalType: "uint256",
							name: "amountOutMinimum",
							type: "uint256",
						},
					],
					internalType: "struct IV3SwapRouter.ExactInputParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "exactInput",
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
					components: [
						{
							internalType: "address",
							name: "tokenIn",
							type: "address",
						},
						{
							internalType: "address",
							name: "tokenOut",
							type: "address",
						},
						{
							internalType: "uint24",
							name: "fee",
							type: "uint24",
						},
						{
							internalType: "address",
							name: "recipient",
							type: "address",
						},
						{
							internalType: "uint256",
							name: "amountIn",
							type: "uint256",
						},
						{
							internalType: "uint256",
							name: "amountOutMinimum",
							type: "uint256",
						},
						{
							internalType: "uint160",
							name: "sqrtPriceLimitX96",
							type: "uint160",
						},
					],
					internalType: "struct IV3SwapRouter.ExactInputSingleParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "exactInputSingle",
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
					components: [
						{
							internalType: "bytes",
							name: "path",
							type: "bytes",
						},
						{
							internalType: "address",
							name: "recipient",
							type: "address",
						},
						{
							internalType: "uint256",
							name: "amountOut",
							type: "uint256",
						},
						{
							internalType: "uint256",
							name: "amountInMaximum",
							type: "uint256",
						},
					],
					internalType: "struct IV3SwapRouter.ExactOutputParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "exactOutput",
			outputs: [
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					components: [
						{
							internalType: "address",
							name: "tokenIn",
							type: "address",
						},
						{
							internalType: "address",
							name: "tokenOut",
							type: "address",
						},
						{
							internalType: "uint24",
							name: "fee",
							type: "uint24",
						},
						{
							internalType: "address",
							name: "recipient",
							type: "address",
						},
						{
							internalType: "uint256",
							name: "amountOut",
							type: "uint256",
						},
						{
							internalType: "uint256",
							name: "amountInMaximum",
							type: "uint256",
						},
						{
							internalType: "uint160",
							name: "sqrtPriceLimitX96",
							type: "uint160",
						},
					],
					internalType: "struct IV3SwapRouter.ExactOutputSingleParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "exactOutputSingle",
			outputs: [
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [],
			name: "factory",
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
			name: "factoryV2",
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
					internalType: "address",
					name: "token",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "amount",
					type: "uint256",
				},
			],
			name: "getApprovalType",
			outputs: [
				{
					internalType: "enum IApproveAndCall.ApprovalType",
					name: "",
					type: "uint8",
				},
			],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [
				{
					components: [
						{
							internalType: "address",
							name: "token0",
							type: "address",
						},
						{
							internalType: "address",
							name: "token1",
							type: "address",
						},
						{
							internalType: "uint256",
							name: "tokenId",
							type: "uint256",
						},
						{
							internalType: "uint256",
							name: "amount0Min",
							type: "uint256",
						},
						{
							internalType: "uint256",
							name: "amount1Min",
							type: "uint256",
						},
					],
					internalType: "struct IApproveAndCall.IncreaseLiquidityParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "increaseLiquidity",
			outputs: [
				{
					internalType: "bytes",
					name: "result",
					type: "bytes",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					components: [
						{
							internalType: "address",
							name: "token0",
							type: "address",
						},
						{
							internalType: "address",
							name: "token1",
							type: "address",
						},
						{
							internalType: "uint24",
							name: "fee",
							type: "uint24",
						},
						{
							internalType: "int24",
							name: "tickLower",
							type: "int24",
						},
						{
							internalType: "int24",
							name: "tickUpper",
							type: "int24",
						},
						{
							internalType: "uint256",
							name: "amount0Min",
							type: "uint256",
						},
						{
							internalType: "uint256",
							name: "amount1Min",
							type: "uint256",
						},
						{
							internalType: "address",
							name: "recipient",
							type: "address",
						},
					],
					internalType: "struct IApproveAndCall.MintParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "mint",
			outputs: [
				{
					internalType: "bytes",
					name: "result",
					type: "bytes",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "bytes32",
					name: "previousBlockhash",
					type: "bytes32",
				},
				{
					internalType: "bytes[]",
					name: "data",
					type: "bytes[]",
				},
			],
			name: "multicall",
			outputs: [
				{
					internalType: "bytes[]",
					name: "",
					type: "bytes[]",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "uint256",
					name: "deadline",
					type: "uint256",
				},
				{
					internalType: "bytes[]",
					name: "data",
					type: "bytes[]",
				},
			],
			name: "multicall",
			outputs: [
				{
					internalType: "bytes[]",
					name: "",
					type: "bytes[]",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "bytes[]",
					name: "data",
					type: "bytes[]",
				},
			],
			name: "multicall",
			outputs: [
				{
					internalType: "bytes[]",
					name: "results",
					type: "bytes[]",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [],
			name: "positionManager",
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
					internalType: "address",
					name: "token",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "value",
					type: "uint256",
				},
			],
			name: "pull",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [],
			name: "refundETH",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
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
			name: "selfPermit",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "nonce",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "expiry",
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
			name: "selfPermitAllowed",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "nonce",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "expiry",
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
			name: "selfPermitAllowedIfNecessary",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
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
			name: "selfPermitIfNecessary",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
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
					internalType: "address[]",
					name: "path",
					type: "address[]",
				},
				{
					internalType: "address",
					name: "to",
					type: "address",
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
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
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
				{
					internalType: "address[]",
					name: "path",
					type: "address[]",
				},
				{
					internalType: "address",
					name: "to",
					type: "address",
				},
			],
			name: "swapTokensForExactTokens",
			outputs: [
				{
					internalType: "uint256",
					name: "amountIn",
					type: "uint256",
				},
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "amountMinimum",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "recipient",
					type: "address",
				},
			],
			name: "sweepToken",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "amountMinimum",
					type: "uint256",
				},
			],
			name: "sweepToken",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "amountMinimum",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "feeBips",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "feeRecipient",
					type: "address",
				},
			],
			name: "sweepTokenWithFee",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "address",
					name: "token",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "amountMinimum",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "recipient",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "feeBips",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "feeRecipient",
					type: "address",
				},
			],
			name: "sweepTokenWithFee",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "int256",
					name: "amount0Delta",
					type: "int256",
				},
				{
					internalType: "int256",
					name: "amount1Delta",
					type: "int256",
				},
				{
					internalType: "bytes",
					name: "_data",
					type: "bytes",
				},
			],
			name: "uniswapV3SwapCallback",
			outputs: [],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "uint256",
					name: "amountMinimum",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "recipient",
					type: "address",
				},
			],
			name: "unwrapWETH9",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "uint256",
					name: "amountMinimum",
					type: "uint256",
				},
			],
			name: "unwrapWETH9",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "uint256",
					name: "amountMinimum",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "recipient",
					type: "address",
				},
				{
					internalType: "uint256",
					name: "feeBips",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "feeRecipient",
					type: "address",
				},
			],
			name: "unwrapWETH9WithFee",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "uint256",
					name: "amountMinimum",
					type: "uint256",
				},
				{
					internalType: "uint256",
					name: "feeBips",
					type: "uint256",
				},
				{
					internalType: "address",
					name: "feeRecipient",
					type: "address",
				},
			],
			name: "unwrapWETH9WithFee",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					internalType: "uint256",
					name: "value",
					type: "uint256",
				},
			],
			name: "wrapETH",
			outputs: [],
			stateMutability: "payable",
			type: "function",
		},
		{
			stateMutability: "payable",
			type: "receive",
		},
	],

	// NFT Position Manager ABI for liquidity management
	NFT_POSITION_MANAGER: [
		{
			inputs: [
				{
					components: [
						{ internalType: "address", name: "token0", type: "address" },
						{ internalType: "address", name: "token1", type: "address" },
						{ internalType: "uint24", name: "fee", type: "uint24" },
						{ internalType: "int24", name: "tickLower", type: "int24" },
						{ internalType: "int24", name: "tickUpper", type: "int24" },
						{
							internalType: "uint256",
							name: "amount0Desired",
							type: "uint256",
						},
						{
							internalType: "uint256",
							name: "amount1Desired",
							type: "uint256",
						},
						{ internalType: "uint256", name: "amount0Min", type: "uint256" },
						{ internalType: "uint256", name: "amount1Min", type: "uint256" },
						{ internalType: "address", name: "recipient", type: "address" },
						{ internalType: "uint256", name: "deadline", type: "uint256" },
					],
					internalType: "struct INonfungiblePositionManager.MintParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "mint",
			outputs: [
				{ internalType: "uint256", name: "tokenId", type: "uint256" },
				{ internalType: "uint128", name: "liquidity", type: "uint128" },
				{ internalType: "uint256", name: "amount0", type: "uint256" },
				{ internalType: "uint256", name: "amount1", type: "uint256" },
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					components: [
						{ internalType: "uint256", name: "tokenId", type: "uint256" },
						{ internalType: "uint128", name: "liquidity", type: "uint128" },
						{ internalType: "uint256", name: "amount0Min", type: "uint256" },
						{ internalType: "uint256", name: "amount1Min", type: "uint256" },
						{ internalType: "uint256", name: "deadline", type: "uint256" },
					],
					internalType:
						"struct INonfungiblePositionManager.DecreaseLiquidityParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "decreaseLiquidity",
			outputs: [
				{ internalType: "uint256", name: "amount0", type: "uint256" },
				{ internalType: "uint256", name: "amount1", type: "uint256" },
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					components: [
						{ internalType: "uint256", name: "tokenId", type: "uint256" },
						{ internalType: "address", name: "recipient", type: "address" },
						{ internalType: "uint128", name: "amount0Max", type: "uint128" },
						{ internalType: "uint128", name: "amount1Max", type: "uint128" },
					],
					internalType: "struct INonfungiblePositionManager.CollectParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "collect",
			outputs: [
				{ internalType: "uint256", name: "amount0", type: "uint256" },
				{ internalType: "uint256", name: "amount1", type: "uint256" },
			],
			stateMutability: "payable",
			type: "function",
		},
		// Add these two objects to the ABIS.NFT_POSITION_MANAGER array in constants.ts

		{
			name: "balanceOf",
			type: "function",
			inputs: [
				{
					name: "owner",
					type: "address",
					internalType: "address",
				},
			],
			outputs: [
				{
					name: "",
					type: "uint256",
					internalType: "uint256",
				},
			],
			stateMutability: "view",
		},
		{
			name: "positions",
			type: "function",
			inputs: [
				{
					name: "tokenId",
					type: "uint256",
					internalType: "uint256",
				},
			],
			outputs: [
				{
					name: "nonce",
					type: "uint96",
					internalType: "uint96",
				},
				{
					name: "operator",
					type: "address",
					internalType: "address",
				},
				{
					name: "token0",
					type: "address",
					internalType: "address",
				},
				{
					name: "token1",
					type: "address",
					internalType: "address",
				},
				{
					name: "fee",
					type: "uint24",
					internalType: "uint24",
				},
				{
					name: "tickLower",
					type: "int24",
					internalType: "int24",
				},
				{
					name: "tickUpper",
					type: "int24",
					internalType: "int24",
				},
				{
					name: "liquidity",
					type: "uint128",
					internalType: "uint128",
				},
				{
					name: "feeGrowthInside0LastX128",
					type: "uint256",
					internalType: "uint256",
				},
				{
					name: "feeGrowthInside1LastX128",
					type: "uint256",
					internalType: "uint256",
				},
				{
					name: "tokensOwed0",
					type: "uint128",
					internalType: "uint128",
				},
				{
					name: "tokensOwed1",
					type: "uint128",
					internalType: "uint128",
				},
			],
			stateMutability: "view",
		},
	],

	// V3 Core Factory ABI for pool address lookup
	V3_CORE_FACTORY: [
		{
			inputs: [
				{ internalType: "address", name: "tokenA", type: "address" },
				{ internalType: "address", name: "tokenB", type: "address" },
				{ internalType: "uint24", name: "fee", type: "uint24" },
			],
			name: "getPool",
			outputs: [{ internalType: "address", name: "", type: "address" }],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [],
			name: "owner",
			outputs: [{ internalType: "address", name: "", type: "address" }],
			stateMutability: "view",
			type: "function",
		},
	],
};
