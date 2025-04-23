// Thorn Protocol Contract information
// https://github.com/Thorn-Protocol/thorn-protocol-contract/blob/main/configMainnet.js

// Oasis Sapphire Testnet details
export const SAPPHIRE_TESTNET = {
	RPC_URL: "https://testnet.sapphire.oasis.dev",
	CHAIN_ID: 0x5aff,
	EXPLORER_URL: "https://explorer.oasis.io/testnet/sapphire",
	CONTRACTS: {
		STABLE_SWAP_INFO: "0xdbCF2163c0C14eCdD772a35D205F1f29B58A5f44",
		STABLE_SWAP_THREE_POOL_INFO: "0xBf4713291778Be36aB1A570C83076d3b466f70dC",
		STABLE_SWAP_TWO_POOL_INFO: "0x4dBC46e277d85deabF6b98A75730e7cAc8f77DF7",
		STABLE_SWAP_LP_FACTORY: "0xf0F78baFE2Ae185834d8307019368Edb06266117",
		STABLE_SWAP_TWO_POOL_DEPLOYER: "0xFAb9a9B9e0D499C48aFB2f660AF7f38d30a0B3b0",
		STABLE_SWAP_THREE_POOL_DEPLOYER:
			"0x42504f57906Dbd872de8Ed80e70d1B9cc0468cC0",
		STABLE_SWAP_FACTORY: "0x17686dC3CebE668Bc1b574162f68D00019dD774a",
		SMART_ROUTER_HELPER_LIBRARY: "0x6c5FF7493a7bb8f3833672c295463424b1267c29",
		STABLE_SWAP_ROUTER: "0x7EbBcae22Edb208fCb9047E557c3958Fdf390D04",
	},
};

// Oasis Sapphire Mainnet details
export const SAPPHIRE_MAINNET = {
	RPC_URL: "https://sapphire.oasis.io",
	CHAIN_ID: 0x5afe,
	EXPLORER_URL: "https://explorer.oasis.io/mainnet/sapphire",
	CONTRACTS: {
		STABLE_SWAP_INFO: "0x34048af0289C7EEef37277E57C136F4Fb85373CF",
		STABLE_SWAP_THREE_POOL_INFO: "0xCFdCb6855dCF1d2094B24A0b061439E9A037FB93",
		STABLE_SWAP_TWO_POOL_INFO: "0xe215D7b62Dc139a3F09b8eA23be12bb32a3a538d",
		STABLE_SWAP_LP_FACTORY: "0xE093000349fd504078474F8Cd0d995Bacc59a615",
		STABLE_SWAP_TWO_POOL_DEPLOYER: "0xbA920d999D9Dd6F04690F57D894d3737B394d8B5",
		STABLE_SWAP_THREE_POOL_DEPLOYER:
			"0x510E703B46A52CE73f19fE00E2865a1E156700a4",
		STABLE_SWAP_FACTORY: "0x1B461fAB13bf7f3a723fdCD0Aca1f01538A25Be4",
		SMART_ROUTER_HELPER_LIBRARY: "0xC9dD4C4f3a7782718b33a02CfD31D2B93582ECbE",
		STABLE_SWAP_ROUTER: "0x226929476BC3B66dabE174fc644eCd07C53DA484",
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

// Combined ABIs for easy access
export const ABIS = {
	ERC20: ERC20_ABI,
};
