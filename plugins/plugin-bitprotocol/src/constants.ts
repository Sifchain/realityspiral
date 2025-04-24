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
		inputs: [
			{ internalType: "address", name: "_bitCore", type: "address" },
			{ internalType: "string", name: "name_", type: "string" },
			{ internalType: "string", name: "symbol_", type: "string" },
		],
		stateMutability: "nonpayable",
		type: "constructor",
	},
	{
		inputs: [
			{ internalType: "address", name: "spender", type: "address" },
			{ internalType: "uint256", name: "currentAllowance", type: "uint256" },
			{ internalType: "uint256", name: "value", type: "uint256" },
		],
		name: "ERC20InsufficientAllowance",
		type: "error",
	},
	{
		inputs: [
			{ internalType: "address", name: "account", type: "address" },
			{ internalType: "uint256", name: "balance", type: "uint256" },
			{ internalType: "uint256", name: "value", type: "uint256" },
		],
		name: "ERC20InsufficientBalance",
		type: "error",
	},
	{
		inputs: [{ internalType: "address", name: "approver", type: "address" }],
		name: "ERC20InvalidApprover",
		type: "error",
	},
	{
		inputs: [{ internalType: "address", name: "receiver", type: "address" }],
		name: "ERC20InvalidReceiver",
		type: "error",
	},
	{
		inputs: [{ internalType: "address", name: "sender", type: "address" }],
		name: "ERC20InvalidSender",
		type: "error",
	},
	{
		inputs: [{ internalType: "address", name: "spender", type: "address" }],
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
			{ indexed: true, internalType: "address", name: "from", type: "address" },
			{ indexed: true, internalType: "address", name: "to", type: "address" },
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
			{ internalType: "address", name: "owner", type: "address" },
			{ internalType: "address", name: "spender", type: "address" },
		],
		name: "allowance",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "spender", type: "address" },
			{ internalType: "uint256", name: "value", type: "uint256" },
		],
		name: "approve",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "account", type: "address" }],
		name: "balanceOf",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				components: [
					{ internalType: "address", name: "user", type: "address" },
					{ internalType: "uint256", name: "timestamp", type: "uint256" },
					{ internalType: "bytes", name: "signature", type: "bytes" },
				],
				internalType: "struct BitSignature.SignIn",
				name: "auth",
				type: "tuple",
			},
		],
		name: "checkBalanceOf",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "decimals",
		outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "", type: "address" }],
		name: "lookers",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "name",
		outputs: [{ internalType: "string", name: "", type: "string" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "secrecy",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address[]", name: "_lookers", type: "address[]" },
			{ internalType: "bool[]", name: "_bools", type: "bool[]" },
		],
		name: "setLookers",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "bool", name: "_bool", type: "bool" }],
		name: "setSecrecy",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "symbol",
		outputs: [{ internalType: "string", name: "", type: "string" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "totalSupply",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "to", type: "address" },
			{ internalType: "uint256", name: "value", type: "uint256" },
		],
		name: "transfer",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "from", type: "address" },
			{ internalType: "address", name: "to", type: "address" },
			{ internalType: "uint256", name: "value", type: "uint256" },
		],
		name: "transferFrom",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "nonpayable",
		type: "function",
	},
];

// Price Feed ABI - for price stability monitoring
export const PRICE_FEED_ABI = [
	{
		inputs: [
			{ internalType: "address", name: "_bitCore", type: "address" },
			{
				components: [
					{ internalType: "address", name: "token", type: "address" },
					{ internalType: "address", name: "band", type: "address" },
					{ internalType: "string", name: "base", type: "string" },
					{ internalType: "string", name: "quote", type: "string" },
					{ internalType: "uint32", name: "heartbeat", type: "uint32" },
				],
				internalType: "struct PriceFeed.OracleSetup[]",
				name: "oracles",
				type: "tuple[]",
			},
		],
		stateMutability: "nonpayable",
		type: "constructor",
	},
	{
		inputs: [{ internalType: "address", name: "token", type: "address" }],
		name: "PriceFeed__FeedFrozenError",
		type: "error",
	},
	{
		inputs: [],
		name: "PriceFeed__HeartbeatOutOfBoundsError",
		type: "error",
	},
	{
		inputs: [{ internalType: "address", name: "token", type: "address" }],
		name: "PriceFeed__InvalidFeedResponseError",
		type: "error",
	},
	{
		inputs: [{ internalType: "address", name: "token", type: "address" }],
		name: "PriceFeed__UnknownFeedError",
		type: "error",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "token",
				type: "address",
			},
			{
				indexed: false,
				internalType: "address",
				name: "bandAggregator",
				type: "address",
			},
		],
		name: "NewOracleRegistered",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "token",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "_price",
				type: "uint256",
			},
		],
		name: "PriceRecordUpdated",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "token",
				type: "address",
			},
			{
				indexed: false,
				internalType: "address",
				name: "oracle",
				type: "address",
			},
			{ indexed: false, internalType: "bool", name: "isWorking", type: "bool" },
		],
		name: "PriceFeedStatusUpdated",
		type: "event",
	},
	{
		inputs: [],
		name: "MAX_PRICE_DEVIATION_FROM_PREVIOUS_ROUND",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "RESPONSE_TIMEOUT_BUFFER",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "_token", type: "address" }],
		name: "fetchPrice",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "_token", type: "address" }],
		name: "loadPrice",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "", type: "address" }],
		name: "oracleRecords",
		outputs: [
			{ internalType: "address", name: "bandOracle", type: "address" },
			{ internalType: "string", name: "base", type: "string" },
			{ internalType: "string", name: "quote", type: "string" },
			{ internalType: "uint32", name: "heartbeat", type: "uint32" },
			{ internalType: "bool", name: "isFeedWorking", type: "bool" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "", type: "address" }],
		name: "priceRecords",
		outputs: [
			{ internalType: "uint96", name: "price", type: "uint96" },
			{ internalType: "uint32", name: "timestamp", type: "uint32" },
			{ internalType: "uint32", name: "lastUpdated", type: "uint32" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "_token", type: "address" },
			{ internalType: "address", name: "_bandOracle", type: "address" },
			{ internalType: "string", name: "_base", type: "string" },
			{ internalType: "string", name: "_quote", type: "string" },
			{ internalType: "uint32", name: "_heartbeat", type: "uint32" },
		],
		name: "setOracle",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "lastGoodPrice",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
];

// Borrower Operations ABI - for stablecoin swapping functionality
export const BORROWER_OPERATIONS_ABI = [
	{
		inputs: [{ internalType: "uint256", name: "_minNetDebt", type: "uint256" }],
		name: "setMinNetDebt",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "to", type: "address" },
			{ internalType: "uint256", name: "amount", type: "uint256" },
		],
		name: "sendRose",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "troveManager", type: "address" },
			{ internalType: "address", name: "collateralToken", type: "address" },
		],
		name: "configureCollateral",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "troveManager", type: "address" },
		],
		name: "removeTroveManager",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "getTCR",
		outputs: [
			{
				internalType: "uint256",
				name: "globalTotalCollateralRatio",
				type: "uint256",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "fetchBalances",
		outputs: [
			{
				components: [
					{ internalType: "uint256[]", name: "collaterals", type: "uint256[]" },
					{ internalType: "uint256[]", name: "debts", type: "uint256[]" },
					{ internalType: "uint256[]", name: "prices", type: "uint256[]" },
				],
				internalType: "struct BorrowerOperations.SystemBalances",
				name: "balances",
				type: "tuple",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "uint256", name: "TCR", type: "uint256" }],
		name: "checkRecoveryMode",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "pure",
		type: "function",
	},
	{
		inputs: [{ internalType: "uint256", name: "_debt", type: "uint256" }],
		name: "getCompositeDebt",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "troveManager", type: "address" },
			{ internalType: "address", name: "account", type: "address" },
			{ internalType: "uint256", name: "_maxFeePercentage", type: "uint256" },
			{ internalType: "uint256", name: "_collateralAmount", type: "uint256" },
			{ internalType: "uint256", name: "_debtAmount", type: "uint256" },
			{ internalType: "address", name: "_upperHint", type: "address" },
			{ internalType: "address", name: "_lowerHint", type: "address" },
		],
		name: "openTrove",
		outputs: [],
		stateMutability: "payable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "troveManager", type: "address" },
			{ internalType: "address", name: "account", type: "address" },
			{ internalType: "uint256", name: "_collateralAmount", type: "uint256" },
			{ internalType: "address", name: "_upperHint", type: "address" },
			{ internalType: "address", name: "_lowerHint", type: "address" },
		],
		name: "addColl",
		outputs: [],
		stateMutability: "payable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "troveManager", type: "address" },
			{ internalType: "address", name: "account", type: "address" },
			{ internalType: "uint256", name: "_collWithdrawal", type: "uint256" },
			{ internalType: "address", name: "_upperHint", type: "address" },
			{ internalType: "address", name: "_lowerHint", type: "address" },
		],
		name: "withdrawColl",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "troveManager", type: "address" },
			{ internalType: "address", name: "account", type: "address" },
			{ internalType: "uint256", name: "_maxFeePercentage", type: "uint256" },
			{ internalType: "uint256", name: "_debtAmount", type: "uint256" },
			{ internalType: "address", name: "_upperHint", type: "address" },
			{ internalType: "address", name: "_lowerHint", type: "address" },
		],
		name: "withdrawDebt",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "troveManager", type: "address" },
			{ internalType: "address", name: "account", type: "address" },
			{ internalType: "uint256", name: "_debtAmount", type: "uint256" },
			{ internalType: "address", name: "_upperHint", type: "address" },
			{ internalType: "address", name: "_lowerHint", type: "address" },
		],
		name: "repayDebt",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "troveManager", type: "address" },
			{ internalType: "address", name: "account", type: "address" },
			{ internalType: "uint256", name: "_maxFeePercentage", type: "uint256" },
			{ internalType: "uint256", name: "_collDeposit", type: "uint256" },
			{ internalType: "uint256", name: "_collWithdrawal", type: "uint256" },
			{ internalType: "uint256", name: "_debtChange", type: "uint256" },
			{ internalType: "bool", name: "_isDebtIncrease", type: "bool" },
			{ internalType: "address", name: "_upperHint", type: "address" },
			{ internalType: "address", name: "_lowerHint", type: "address" },
		],
		name: "adjustTrove",
		outputs: [],
		stateMutability: "payable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "troveManager", type: "address" },
			{ internalType: "address", name: "account", type: "address" },
		],
		name: "closeTrove",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "getGlobalSystemBalances",
		outputs: [
			{
				internalType: "uint256",
				name: "totalPricedCollateral",
				type: "uint256",
			},
			{ internalType: "uint256", name: "totalDebt", type: "uint256" },
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "borrower",
				type: "address",
			},
			{
				indexed: false,
				internalType: "address",
				name: "collateralToken",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "BorrowingFeePaid",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "troveManager",
				type: "address",
			},
			{
				indexed: false,
				internalType: "address",
				name: "collateralToken",
				type: "address",
			},
		],
		name: "CollateralConfigured",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "troveManager",
				type: "address",
			},
		],
		name: "TroveManagerRemoved",
		type: "event",
	},
];


// Stability Pool ABI - for automated swap strategies
export const STABILITY_POOL_ABI = [
	{
	  "inputs": [
		{"internalType": "address", "name": "_bitCore", "type": "address"},
		{"internalType": "address", "name": "_debtTokenAddress", "type": "address"},
		{"internalType": "address", "name": "_factory", "type": "address"}
	  ],
	  "stateMutability": "nonpayable",
	  "type": "constructor"
	},
	{
	  "inputs": [],
	  "name": "DECIMAL_PRECISION",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "REWARD_DURATION",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "SCALE_FACTOR",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "SUNSET_DURATION",
	  "outputs": [{"internalType": "uint128", "name": "", "type": "uint128"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "", "type": "address"}
	  ],
	  "name": "accountDeposits",
	  "outputs": [
		{"internalType": "uint128", "name": "amount", "type": "uint128"},
		{"internalType": "uint128", "name": "timestamp", "type": "uint128"}
	  ],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "recipient", "type": "address"},
		{"internalType": "uint256[]", "name": "collateralIndexes", "type": "uint256[]"}
	  ],
	  "name": "claimCollateralGains",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "recipient", "type": "address"}
	  ],
	  "name": "claimReward",
	  "outputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "_depositor", "type": "address"}
	  ],
	  "name": "claimableReward",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "depositor", "type": "address"},
		{"internalType": "uint256", "name": "", "type": "uint256"}
	  ],
	  "name": "collateralGainsByDepositor",
	  "outputs": [{"internalType": "uint80", "name": "", "type": "uint80"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "uint256", "name": "", "type": "uint256"}
	  ],
	  "name": "collateralTokens",
	  "outputs": [{"internalType": "address", "name": "", "type": "address"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "currentEpoch",
	  "outputs": [{"internalType": "uint128", "name": "", "type": "uint128"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "currentScale",
	  "outputs": [{"internalType": "uint128", "name": "", "type": "uint128"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "debtToken",
	  "outputs": [{"internalType": "address", "name": "", "type": "address"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "", "type": "address"},
		{"internalType": "uint256", "name": "", "type": "uint256"}
	  ],
	  "name": "depositSums",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "", "type": "address"}
	  ],
	  "name": "depositSnapshots",
	  "outputs": [
		{"internalType": "uint256", "name": "P", "type": "uint256"},
		{"internalType": "uint256", "name": "G", "type": "uint256"},
		{"internalType": "uint128", "name": "scale", "type": "uint128"},
		{"internalType": "uint128", "name": "epoch", "type": "uint128"}
	  ],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "_collateral", "type": "address"}
	  ],
	  "name": "enableCollateral",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "emissionId",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "uint128", "name": "", "type": "uint128"},
		{"internalType": "uint128", "name": "", "type": "uint128"}
	  ],
	  "name": "epochToScaleToG",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "uint128", "name": "", "type": "uint128"},
		{"internalType": "uint128", "name": "", "type": "uint128"},
		{"internalType": "uint256", "name": "", "type": "uint256"}
	  ],
	  "name": "epochToScaleToSums",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "factory",
	  "outputs": [{"internalType": "address", "name": "", "type": "address"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "_depositor", "type": "address"}
	  ],
	  "name": "getCompoundedDebtDeposit",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "_depositor", "type": "address"}
	  ],
	  "name": "getDepositorCollateralGain",
	  "outputs": [{"internalType": "uint256[]", "name": "collateralGains", "type": "uint256[]"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "getTotalDebtTokenDeposits",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "", "type": "address"}
	  ],
	  "name": "indexByCollateral",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "lastBitError",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "uint256", "name": "", "type": "uint256"}
	  ],
	  "name": "lastCollateralError_Offset",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "lastDebtLossError_Offset",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "lastUpdate",
	  "outputs": [{"internalType": "uint32", "name": "", "type": "uint32"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "liquidationManager",
	  "outputs": [{"internalType": "address", "name": "", "type": "address"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "collateral", "type": "address"},
		{"internalType": "uint256", "name": "_debtToOffset", "type": "uint256"},
		{"internalType": "uint256", "name": "_collToAdd", "type": "uint256"}
	  ],
	  "name": "offset",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "P",
	  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "periodFinish",
	  "outputs": [{"internalType": "uint32", "name": "", "type": "uint32"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "uint256", "name": "_amount", "type": "uint256"}
	  ],
	  "name": "provideToSP",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "rewardRate",
	  "outputs": [{"internalType": "uint128", "name": "", "type": "uint128"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "_vault", "type": "address"},
		{"internalType": "address", "name": "_liquidationManager", "type": "address"}
	  ],
	  "name": "setInitialParameters",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "collateral", "type": "address"}
	  ],
	  "name": "startCollateralSunset",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "vault",
	  "outputs": [{"internalType": "address", "name": "", "type": "address"}],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "address", "name": "claimant", "type": "address"},
		{"internalType": "address", "name": "", "type": "address"}
	  ],
	  "name": "vaultClaimReward",
	  "outputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [
		{"internalType": "uint256", "name": "_amount", "type": "uint256"}
	  ],
	  "name": "withdrawFromSP",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": false, "internalType": "address", "name": "oldCollateral", "type": "address"},
		{"indexed": false, "internalType": "address", "name": "newCollateral", "type": "address"}
	  ],
	  "name": "CollateralOverwritten",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": true, "internalType": "address", "name": "_depositor", "type": "address"},
		{"indexed": false, "internalType": "uint256[]", "name": "_collateral", "type": "uint256[]"}
	  ],
	  "name": "CollateralGainWithdrawn",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": true, "internalType": "address", "name": "_depositor", "type": "address"},
		{"indexed": false, "internalType": "uint256", "name": "_P", "type": "uint256"},
		{"indexed": false, "internalType": "uint256", "name": "_G", "type": "uint256"}
	  ],
	  "name": "DepositSnapshotUpdated",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": false, "internalType": "uint128", "name": "_currentEpoch", "type": "uint128"}
	  ],
	  "name": "EpochUpdated",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": false, "internalType": "uint256", "name": "_G", "type": "uint256"},
		{"indexed": false, "internalType": "uint128", "name": "_epoch", "type": "uint128"},
		{"indexed": false, "internalType": "uint128", "name": "_scale", "type": "uint128"}
	  ],
	  "name": "G_Updated",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": false, "internalType": "uint256", "name": "_P", "type": "uint256"}
	  ],
	  "name": "P_Updated",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": true, "internalType": "address", "name": "account", "type": "address"},
		{"indexed": true, "internalType": "address", "name": "recipient", "type": "address"},
		{"indexed": false, "internalType": "uint256", "name": "claimed", "type": "uint256"}
	  ],
	  "name": "RewardClaimed",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": false, "internalType": "uint256", "name": "idx", "type": "uint256"},
		{"indexed": false, "internalType": "uint256", "name": "_S", "type": "uint256"},
		{"indexed": false, "internalType": "uint128", "name": "_epoch", "type": "uint128"},
		{"indexed": false, "internalType": "uint128", "name": "_scale", "type": "uint128"}
	  ],
	  "name": "S_Updated",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": false, "internalType": "uint128", "name": "_currentScale", "type": "uint128"}
	  ],
	  "name": "ScaleUpdated",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": false, "internalType": "uint256", "name": "_newBalance", "type": "uint256"}
	  ],
	  "name": "StabilityPoolDebtBalanceUpdated",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{"indexed": true, "internalType": "address", "name": "_depositor", "type": "address"},
		{"indexed": false, "internalType": "uint256", "name": "_newDeposit", "type": "uint256"}
	  ],
	  "name": "UserDepositChanged",
	  "type": "event"
	},
	{
	  "stateMutability": "payable",
	  "type": "receive"
	}
  ];

// Trove Manager ABI - for managing troves in swap strategies
export const TROVE_MANAGER_ABI = [
	// Constructor
	{
		inputs: [
			{ name: "_bitCore", type: "address" },
			{ name: "_gasPoolAddress", type: "address" },
			{ name: "_debtTokenAddress", type: "address" },
			{ name: "_borrowerOperationsAddress", type: "address" },
			{ name: "_vault", type: "address" },
			{ name: "_liquidationManager", type: "address" },
			{ name: "_gasCompensation", type: "uint256" },
		],
		stateMutability: "nonpayable",
		type: "constructor",
	},

	// Events
	{
		anonymous: false,
		inputs: [{ indexed: false, name: "_baseRate", type: "uint256" }],
		name: "BaseRateUpdated",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [{ indexed: false, name: "_lastFeeOpTime", type: "uint256" }],
		name: "LastFeeOpTimeUpdated",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: false, name: "_totalStakesSnapshot", type: "uint256" },
			{ indexed: false, name: "_totalCollateralSnapshot", type: "uint256" },
		],
		name: "SystemSnapshotsUpdated",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: false, name: "_L_collateral", type: "uint256" },
			{ indexed: false, name: "_L_debt", type: "uint256" },
		],
		name: "LTermsUpdated",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: false, name: "_L_collateral", type: "uint256" },
			{ indexed: false, name: "_L_debt", type: "uint256" },
		],
		name: "TroveSnapshotsUpdated",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: false, name: "_borrower", type: "address" },
			{ indexed: false, name: "_newIndex", type: "uint256" },
		],
		name: "TroveIndexUpdated",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: false, name: "_to", type: "address" },
			{ indexed: false, name: "_amount", type: "uint256" },
		],
		name: "CollateralSent",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: true, name: "account", type: "address" },
			{ indexed: true, name: "recipient", type: "address" },
			{ indexed: false, name: "claimed", type: "uint256" },
		],
		name: "RewardClaimed",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: false, name: "_attemptedDebtAmount", type: "uint256" },
			{ indexed: false, name: "_actualDebtAmount", type: "uint256" },
			{ indexed: false, name: "_collateralSent", type: "uint256" },
			{ indexed: false, name: "_collateralFee", type: "uint256" },
		],
		name: "Redemption",
		type: "event",
	},

	// External and Public Functions
	{
		inputs: [
			{ name: "_priceFeedAddress", type: "address" },
			{ name: "_sortedTrovesAddress", type: "address" },
			{ name: "_collateralToken", type: "address" },
		],
		name: "setAddresses",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "_assignedIds", type: "uint256[]" }],
		name: "notifyRegisteredId",
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "_paused", type: "bool" }],
		name: "setPaused",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "_priceFeedAddress", type: "address" },
			{ name: "_lpChecker", type: "address" },
		],
		name: "setPriceFeed",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "_lookers", type: "address[]" },
			{ name: "_bools", type: "bool[]" },
		],
		name: "setLookers",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "startSunset",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "_minuteDecayFactor", type: "uint256" },
			{ name: "_redemptionFeeFloor", type: "uint256" },
			{ name: "_maxRedemptionFee", type: "uint256" },
			{ name: "_borrowingFeeFloor", type: "uint256" },
			{ name: "_maxBorrowingFee", type: "uint256" },
			{ name: "_interestRateInBPS", type: "uint256" },
			{ name: "_maxSystemDebt", type: "uint256" },
			{ name: "_MCR", type: "uint256" },
		],
		name: "setParameters",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "collectInterests",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "fetchPrice",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "loadPrice",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getWeekAndDay",
		outputs: [
			{ name: "", type: "uint256" },
			{ name: "", type: "uint256" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "week", type: "uint256" }],
		name: "getTotalMints",
		outputs: [{ name: "", type: "uint32[7]" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getTroveOwnersCount",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_index", type: "uint256" }],
		name: "getTroveFromTroveOwnersArray",
		outputs: [{ name: "", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getTrove",
		outputs: [
			{
				components: [
					{ name: "debt", type: "uint256" },
					{ name: "coll", type: "uint256" },
					{ name: "stake", type: "uint256" },
					{ name: "status", type: "uint8" },
					{ name: "arrayIndex", type: "uint128" },
					{ name: "activeInterestIndex", type: "uint256" },
				],
				name: "",
				type: "tuple",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getTroveStatus",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getTroveStake",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getTroveCollAndDebt",
		outputs: [
			{ name: "coll", type: "uint256" },
			{ name: "debt", type: "uint256" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getEntireDebtAndColl",
		outputs: [
			{ name: "debt", type: "uint256" },
			{ name: "coll", type: "uint256" },
			{ name: "pendingDebtReward", type: "uint256" },
			{ name: "pendingCollateralReward", type: "uint256" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getEntireSystemColl",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getEntireSystemDebt",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getEntireSystemBalances",
		outputs: [
			{ name: "", type: "uint256" },
			{ name: "", type: "uint256" },
			{ name: "", type: "uint256" },
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getNominalICR",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ name: "_borrower", type: "address" },
			{ name: "_price", type: "uint256" },
		],
		name: "getCurrentICR",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getTotalActiveCollateral",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getTotalActiveDebt",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "getPendingCollAndDebtRewards",
		outputs: [
			{ name: "", type: "uint256" },
			{ name: "", type: "uint256" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "hasPendingRewards",
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getRedemptionRate",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getRedemptionRateWithDecay",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_collateralDrawn", type: "uint256" }],
		name: "getRedemptionFeeWithDecay",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getBorrowingRate",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "getBorrowingRateWithDecay",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_debt", type: "uint256" }],
		name: "getBorrowingFee",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "_debt", type: "uint256" }],
		name: "getBorrowingFeeWithDecay",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ name: "_debtAmount", type: "uint256" },
			{ name: "_firstRedemptionHint", type: "address" },
			{ name: "_upperPartialRedemptionHint", type: "address" },
			{ name: "_lowerPartialRedemptionHint", type: "address" },
			{ name: "_partialRedemptionHintNICR", type: "uint256" },
			{ name: "_maxIterations", type: "uint256" },
			{ name: "_maxFeePercentage", type: "uint256" },
		],
		name: "redeemCollateral",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "_receiver", type: "address" }],
		name: "claimCollateral",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "receiver", type: "address" }],
		name: "claimReward",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "claimant", type: "address" },
			{ name: "", type: "address" },
		],
		name: "vaultClaimReward",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "account", type: "address" }],
		name: "storePendingReward",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "account", type: "address" }],
		name: "claimableReward",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ name: "_borrower", type: "address" },
			{ name: "_collateralAmount", type: "uint256" },
			{ name: "_compositeDebt", type: "uint256" },
			{ name: "NICR", type: "uint256" },
			{ name: "_upperHint", type: "address" },
			{ name: "_lowerHint", type: "address" },
			{ name: "_isRecoveryMode", type: "bool" },
		],
		name: "openTrove",
		outputs: [
			{ name: "stake", type: "uint256" },
			{ name: "arrayIndex", type: "uint256" },
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "_isRecoveryMode", type: "bool" },
			{ name: "_isDebtIncrease", type: "bool" },
			{ name: "_debtChange", type: "uint256" },
			{ name: "_netDebtChange", type: "uint256" },
			{ name: "_isCollIncrease", type: "bool" },
			{ name: "_collChange", type: "uint256" },
			{ name: "_upperHint", type: "address" },
			{ name: "_lowerHint", type: "address" },
			{ name: "_borrower", type: "address" },
			{ name: "_receiver", type: "address" },
		],
		name: "updateTroveFromAdjustment",
		outputs: [
			{ name: "", type: "uint256" },
			{ name: "", type: "uint256" },
			{ name: "", type: "uint256" },
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "_borrower", type: "address" },
			{ name: "_receiver", type: "address" },
			{ name: "collAmount", type: "uint256" },
			{ name: "debtAmount", type: "uint256" },
		],
		name: "closeTrove",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "_debt", type: "uint256" }],
		name: "decayBaseRateAndGetBorrowingFee",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "applyPendingRewards",
		outputs: [
			{ name: "coll", type: "uint256" },
			{ name: "debt", type: "uint256" },
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ name: "_borrower", type: "address" }],
		name: "closeTroveByLiquidation",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "_debt", type: "uint256" },
			{ name: "_collateral", type: "uint256" },
		],
		name: "movePendingTroveRewardsToActiveBalances",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "borrower", type: "address" },
			{ name: "collSurplus", type: "uint256" },
		],
		name: "addCollateralSurplus",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "_liquidator", type: "address" },
			{ name: "_debt", type: "uint256" },
			{ name: "_coll", type: "uint256" },
			{ name: "_collSurplus", type: "uint256" },
			{ name: "_debtGasComp", type: "uint256" },
			{ name: "_collGasComp", type: "uint256" },
		],
		name: "finalizeLiquidation",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ name: "account", type: "address" },
			{ name: "debt", type: "uint256" },
			{ name: "coll", type: "uint256" },
		],
		name: "decreaseDebtAndSendCollateral",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "updateBalances",
		outputs: [],
		stateMutability: "nonpayable",
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

