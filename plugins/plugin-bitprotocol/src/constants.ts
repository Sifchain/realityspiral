// Contract addresses from official BitProtocol documentation
// Source: https://bitprotocol.gitbook.io/bitprotocol/resources/contracts
export const BITPROTOCOL_CONTRACTS = {
	BitCore: "0xaE938aeA37E7fFEc61bb645a98093Fd75f2a8286",
	GasPool: "0xe97E9077590811E0156fc6A502e6d6948BF3876e",
	MultiTroveGetter: "0xDbcaAa5Fe265A18a6123F1C6c252e2E6570f7ACD",
	SortedTroves: "0x29b16229e41B649c6A55D296855b826bFD694D64",
	BitToken: "0x94E4b9C5B544EdD825F62fBE094E90C7Cc363B91",
	DebtToken: "0xA14167756d9F86Aed12b472C29B257BBdD9974C2", // BitUSDs
	FeeReceiver: "0xc067F4658c57FD465F8458e09F0988F599B8f9D8",
	IncentiveVoting: "0x8aC0f9Ad26a36C76d78899b42E6aBd0d805A46A6",
	PriceFeed: "0xd35c6AAA15F04C29E09635FB08f26C288ccE87Dd",
	Factory: "0xD58b7e6aC330a4bB7DA02AC626aaC527B0c8c6Cc",
	TokenLocker: "0x32F50d6662fbe972713ac39DBA98C0C526017f2C",
	BorrowerOperations: "0x9be6f065aFC34ca99e82af0f0BfB9a01E3f919eE",
	StabilityPool: "0x5aa111d889E9C6e3cca8A86430665b5CE7DfcdFf",
	TroveManagerGetters: "0x674487D9b51E9d14778f260e0B259fF9d61bB361",
	BitVault: "0x6D4b43f6378d0b74EE8BF2F88630103518E0af30",
	LiquidationManager: "0x8926956A9E49D8cc83770E05735D4dff508C59E4",
	MultiCollateralHintHelpers: "0xA0576AD90c960faf8a52B8D5647BF88A30fbc8e1",
	EmissionSchedule: "0x31111Cdd8061A1C55e801Ee70d7E23Ba24c5Db02",
	TroveManagerImpl: "0xa16ed0B92a27E8F7fFf1aB513c607115636cb63f",
	TroveManager_wstROSE: "0x57D51c99b7EB39c978c9E4493D74Ea79495999b0",
	TroveManager_ROSE: "0xC91EDf48269D0373c17718F6D281D34908a5700d",
	Adapter_wstROSE: "0x89be90AA5f97ba655878e99fF46ca7D199ed1762",
	TroveManager_mTBill: "0x4E77238627F1D2516eb05ec0b0B38f86905d60bc",
	Adapter_mTBill: "0x164a8e5ecd0312f9D25Fc0Cc265e7443Eaa57B0F",
	CustomTroveManagerImpl_mTBill: "0x35f1D05d1Ad481D0FccC764d521c0Cd435c93527",
	BitUSDs: "0xA14167756d9F86Aed12b472C29B257BBdD9974C2", // Same as DebtToken, added for clarity
};

// Network Configuration
export const NETWORK_CONFIG = {
	// Oasis Sapphire Mainnet
	OASIS_SAPPHIRE: {
		chainId: 23294,
		name: "Oasis Sapphire",
		rpcUrl: "https://sapphire.oasis.io",
		blockExplorer: "https://explorer.sapphire.oasis.io",
		isPrivacyNetwork: true,
	},
	// Oasis Sapphire Testnet
	OASIS_SAPPHIRE_TESTNET: {
		chainId: 23295,
		name: "Oasis Sapphire Testnet",
		rpcUrl: "https://testnet.sapphire.oasis.io",
		blockExplorer: "https://testnet.explorer.sapphire.oasis.io",
		isPrivacyNetwork: true,
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

// Price Feed ABI - for price stability monitoring
export const PRICE_FEED_ABI = [
	{
		inputs: [],
		name: "lastGoodPrice",
		outputs: [{ type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "fetchPrice",
		outputs: [{ type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
];

// Borrower Operations ABI - for stablecoin swapping functionality
export const BORROWER_OPERATIONS_ABI = [
	{
		inputs: [
			{ name: "_tokenAddress", type: "address" },
			{ name: "_tokenAmount", type: "uint256" },
			{ name: "_maxFee", type: "uint256" },
			{ name: "_BitUSDAmt", type: "uint256" },
			{ name: "_upperHint", type: "address" },
			{ name: "_lowerHint", type: "address" },
		],
		name: "openTrove",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "_tokenAddress", type: "address" },
			{ name: "_tokenAmount", type: "uint256" },
			{ name: "_maxFee", type: "uint256" },
			{ name: "_BitUSDAmt", type: "uint256" },
			{ name: "_upperHint", type: "address" },
			{ name: "_lowerHint", type: "address" },
		],
		name: "adjustTrove",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "_tokenAddress", type: "address" },
			{ name: "_BitUSDAmt", type: "uint256" },
			{ name: "_upperHint", type: "address" },
			{ name: "_lowerHint", type: "address" },
		],
		name: "closeTrove",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	// For confidential swaps
	{
		inputs: [
			{ name: "_tokenAddress", type: "address" },
			{ name: "_BitUSDAmt", type: "uint256" },
			{ name: "_recipient", type: "address" },
			{ name: "_nonce", type: "uint256" },
		],
		name: "confidentialSwap",
		outputs: [{ name: "success", type: "bool" }],
		stateMutability: "nonpayable",
		type: "function",
	},
];

// Stability Pool ABI - for automated swap strategies
export const STABILITY_POOL_ABI = [
	{
		inputs: [{ name: "_amount", type: "uint256" }],
		name: "provideToSP",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "_amount", type: "uint256" }],
		name: "withdrawFromSP",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "_depositor", type: "address" }],
		name: "getDepositorBitUSDLoss",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_depositor", type: "address" }],
		name: "getDepositorGain",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getCompoundedBitUSDDeposit",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
];

// Trove Manager ABI - for managing troves in swap strategies
export const TROVE_MANAGER_ABI = [
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getTroveStatus",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getTroveDebt",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getTroveColl",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
];

// Router ABI for optimal swap path and stablecoin swapping
export const ROUTER_ABI = [
	{
		inputs: [
			{ name: "fromToken", type: "address" },
			{ name: "toToken", type: "address" },
			{ name: "amountIn", type: "uint256" },
		],
		name: "getOptimalPath",
		outputs: [
			{ name: "path", type: "address[]" },
			{ name: "estimatedOutput", type: "uint256" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ name: "fromToken", type: "address" },
			{ name: "toToken", type: "address" },
			{ name: "amountIn", type: "uint256" },
			{ name: "minAmountOut", type: "uint256" },
			{ name: "deadline", type: "uint256" },
		],
		name: "swap",
		outputs: [{ name: "amountOut", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "fromToken", type: "address" },
			{ name: "toToken", type: "address" },
			{ name: "amountIn", type: "uint256" },
			{ name: "minAmountOut", type: "uint256" },
			{ name: "deadline", type: "uint256" },
			{ name: "encryptedData", type: "bytes" },
		],
		name: "privateSwap",
		outputs: [{ name: "amountOut", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
];

// Default assumed decimals for tokens
export const DEFAULT_DECIMALS = 18;

// Collateral token addresses
export const COLLATERAL_TOKENS = {
	ROSE: {
		address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native token address placeholder
		symbol: "ROSE",
		name: "Oasis ROSE",
		decimals: 18,
		isNative: true,
	},
	wstROSE: {
		address: "0x57D51c99b7EB39c978c9E4493D74Ea79495999b0", // Placeholder - update with actual address
		symbol: "wstROSE",
		name: "Wrapped Staked ROSE",
		decimals: 18,
		isNative: false,
	},
	mTBill: {
		address: "0x4E77238627F1D2516eb05ec0b0B38f86905d60bc", // Placeholder - update with actual address
		symbol: "mTBill",
		name: "Maturity Treasury Bill",
		decimals: 18,
		isNative: false,
	},
};

// Map known token symbols to addresses
export const TOKEN_ADDRESSES: { [symbol: string]: string } = {
	BitUSD: BITPROTOCOL_CONTRACTS.DebtToken,
	BIT: BITPROTOCOL_CONTRACTS.BitToken,
	ROSE: COLLATERAL_TOKENS.ROSE.address,
	wstROSE: COLLATERAL_TOKENS.wstROSE.address,
	mTBill: COLLATERAL_TOKENS.mTBill.address,
};

// Privacy preservation constants
export const PRIVACY_CONFIG = {
	TEE_ENABLED: true, // Trusted Execution Environment setting
	CONFIDENTIAL_TX: true, // Enable confidential transactions
	ENCRYPTION_KEY_SIZE: 256, // Key size in bits
	MINIMUM_GAS_FOR_PRIVACY: 300000, // Minimum gas to ensure privacy operations complete
};

// Combine all ABIs in a single object for easier access
export const ABIS = {
	ERC20: ERC20_ABI,
	PRICE_FEED: PRICE_FEED_ABI,
	BORROWER_OPERATIONS: BORROWER_OPERATIONS_ABI,
	STABILITY_POOL: STABILITY_POOL_ABI,
	TROVE_MANAGER: TROVE_MANAGER_ABI,
	ROUTER: ROUTER_ABI,
};
