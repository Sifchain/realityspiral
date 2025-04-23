import { ethers } from "ethers";

// TODO: Verify these addresses and add addresses for Testnet if available
export const BITPROTOCOL_CONTRACTS = {
	// Addresses from GitHub Issue comment (assuming Oasis Sapphire Mainnet/Testnet based on context)
	BitCore: "0xaE938aeA37E7fFEc61bb645a98093Fd75f2a8286",
	GasPool: "0xe97E9077590811E0156fc6A502e6d6948BF3876e",
	MultiTroveGetter: "0xDbcaAa5Fe265A18a6123F1C6c252e2E6570f7ACD",
	SortedTroves: "0x29b16229e41B649c6A55D296855b826bFD694D64",
	BitToken: "0x94E4b9C5B544EdD825F62fBE094E90C7Cc363B91", // Assuming BIT is the protocol token
	DebtToken: "0xA14167756d9F86Aed12b472C29B257BBdD9974C2", // Assuming BitUSDs is the DebtToken
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
};

// --- Placeholder ABIs --- //
// IMPORTANT: Replace these with the actual ABIs from BitProtocol documentation or contract sources

export const ERC20_ABI = [
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
	"function balanceOf(address account) view returns (uint256)",
	"function decimals() view returns (uint8)",
	"function name() view returns (string)",
	"function symbol() view returns (string)",
	"function totalSupply() view returns (uint256)",
	"function transfer(address recipient, uint256 amount) returns (bool)",
	"function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
	"event Approval(address indexed owner, address indexed spender, uint256 value)",
	"event Transfer(address indexed from, address indexed to, uint256 value)",
];

// Placeholder ABI for BorrowerOperations - Add actual functions needed for swap
export const BORROWER_OPERATIONS_ABI = [
	// Example: Function to potentially adjust trove (might be part of swap)
	// 'function adjustTrove(uint maxFeePercentage, uint collateralWithdrawal, uint debtChange, bool isDebtIncrease, address upperHint, address lowerHint) external payable',
	// Example: Function to open a trove (might be first step)
	// 'function openTrove(uint maxFeePercentage, uint debtAmount, address upperHint, address lowerHint) external payable',
	// Example: Function to repay debt (might be part of swap)
	// 'function repayDebt(uint debtAmount, address upperHint, address lowerHint) external',
	// Placeholder for a direct swap function if it exists within this contract
	// 'function swap(...) external returns (...)'
	// Need actual function signatures from BitProtocol contracts
];

// Placeholder ABI for PriceFeed
export const PRICE_FEED_ABI = [
	"function fetchPrice() view returns (uint256 price)", // Common pattern, verify actual function
	"function lastGoodPrice() view returns (uint256 price)", // Another common pattern
];

// Placeholder ABI for finding swap paths (if using MultiCollateralHintHelpers or similar)
export const HINT_HELPERS_ABI = [
	// Example: Function to get hints for trove operations (might inform swap paths)
	// 'function getApproxHint(uint debtChange, uint collateralChange, uint numTrials) view returns (address hintAddress, uint diff, uint latestRandomSeed)'
];

// Add other ABIs as needed (TroveManager, StabilityPool, etc.) based on swap implementation

// Default assumed decimals for tokens (override if necessary)
export const DEFAULT_DECIMALS = 18;

// Map known token symbols to addresses (expand as needed)
// TODO: Add addresses for common tokens on Oasis Sapphire (USDC, WETH, etc.)
export const TOKEN_ADDRESSES: { [symbol: string]: string } = {
	BitUSD: BITPROTOCOL_CONTRACTS.DebtToken,
	BIT: BITPROTOCOL_CONTRACTS.BitToken,
	// Add ROSE, wstROSE, mTBill if they are directly swappable
	// ROSE: '0x...', // Need native/wrapped ROSE address on Sapphire
	// wstROSE: '0x...',
	// mTBill: '0x...'
}; 