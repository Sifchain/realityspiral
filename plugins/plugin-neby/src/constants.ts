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
		ROSE: "0xed57966f1566de1a90042d07403021ea52ad4724", // Native ROSE token
		USDC: "0x3cabbe76ea8b4e7a2c0a69812cbe671800379ec8", // USDC stablecoin on Sapphire
		WETH: "0xA76E0Fd63bEdBC4406B0689390f8608601d0bA71", // Wrapped ETH on Sapphire
		WBTC: "0xB65548d5A38F4652C26a4B0d5B0Af19E59F37B53", // Wrapped BTC on Sapphire
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
		SWAP_ROUTER_02: "0x14bD5C4dA62B36dC4Db587B1571DB7C7419E94A5", // Testnet router
		HARVESTER: "0xd37FFa87A7b0e2b2678287A7B1B47f76E56D7e37", // Testnet harvester
		LIQUIDITY_POSITION_STAKER: "0x6E5842a5A25f36c95a7C1246C052F4912378FF26", // Testnet position staker
		NEBY_STAKER: "0x9C0ccEC208a619312f4CeB5f4B578c3bE4724A33", // Testnet staker
		UNIVERSAL_ROUTER: "0x5D65C5c6936e8dAE9DB84443ED3Bf4727C9e4dD9", // Testnet universal router
		PERMIT2: "0x93dDB2453b6F4925D772301BB3D0da63CB8D41FE", // Testnet permit2
	},
	TOKENS: {
		ROSE: "0xed57966f1566de1a90042d07403021ea52ad4724", // Testnet native ROSE
		USDC: "0x7fE291B37C72bf8A5cA1E1DD023C6A46D7C456B5", // Testnet USDC
		WETH: "0xD26114cd6EE289AccF82350c8d8487fedB8A0C07", // Testnet WETH
		WBTC: "0x8ddB5Df11d7d3e52c8Fb4CDF15Ecd1c814fC2A95", // Testnet WBTC
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
	],

	// Quoter contract ABI for price quotes
	QUOTER: [
		{
			inputs: [
				{ internalType: "address", name: "tokenIn", type: "address" },
				{ internalType: "address", name: "tokenOut", type: "address" },
				{ internalType: "uint24", name: "fee", type: "uint24" },
				{ internalType: "uint256", name: "amountIn", type: "uint256" },
				{ internalType: "uint160", name: "sqrtPriceLimitX96", type: "uint160" },
			],
			name: "quoteExactInputSingle",
			outputs: [
				{ internalType: "uint256", name: "amountOut", type: "uint256" },
			],
			stateMutability: "nonpayable",
			type: "function",
		},
		{
			inputs: [
				{ internalType: "bytes", name: "path", type: "bytes" },
				{ internalType: "uint256", name: "amountIn", type: "uint256" },
			],
			name: "quoteExactInput",
			outputs: [
				{ internalType: "uint256", name: "amountOut", type: "uint256" },
			],
			stateMutability: "nonpayable",
			type: "function",
		},
	],

	// SwapRouter02 ABI for executing swaps
	SWAP_ROUTER: [
		{
			inputs: [
				{
					components: [
						{ internalType: "address", name: "tokenIn", type: "address" },
						{ internalType: "address", name: "tokenOut", type: "address" },
						{ internalType: "uint24", name: "fee", type: "uint24" },
						{ internalType: "address", name: "recipient", type: "address" },
						{ internalType: "uint256", name: "amountIn", type: "uint256" },
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
					internalType: "struct ISwapRouter.ExactInputSingleParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "exactInputSingle",
			outputs: [
				{ internalType: "uint256", name: "amountOut", type: "uint256" },
			],
			stateMutability: "payable",
			type: "function",
		},
		{
			inputs: [
				{
					components: [
						{ internalType: "bytes", name: "path", type: "bytes" },
						{ internalType: "address", name: "recipient", type: "address" },
						{ internalType: "uint256", name: "amountIn", type: "uint256" },
						{
							internalType: "uint256",
							name: "amountOutMinimum",
							type: "uint256",
						},
					],
					internalType: "struct ISwapRouter.ExactInputParams",
					name: "params",
					type: "tuple",
				},
			],
			name: "exactInput",
			outputs: [
				{ internalType: "uint256", name: "amountOut", type: "uint256" },
			],
			stateMutability: "payable",
			type: "function",
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
