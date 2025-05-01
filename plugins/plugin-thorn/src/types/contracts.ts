/**
 * Type definitions for Thorn Protocol contract interactions
 */

// Types for StableSwapInfo contract
export interface LiquidityPool {
	id: string;
	token0: string;
	token1: string;
	reserve0: string;
	reserve1: string;
	fee: string;
	address: string;
	factory: string;
}

// Types for token balances and approvals
export interface TokenInfo {
	address: string;
	symbol: string;
	name: string;
	decimals: number;
	balance: string;
	allowance: string;
}

// Types for swap result data
export interface SwapResult {
	transactionHash: string;
	fromToken: string;
	toToken: string;
	sentAmount: string;
	receivedAmount: string;
	exchangeRate: string;
	fee: string;
	timestamp: number;
	privacyLevel: string;
}

// Types for swap quotes
export interface SwapQuote {
	fromToken: string;
	toToken: string;
	inputAmount: string;
	outputAmount: string;
	expectedOutput: string;
	minimumOutput: string;
	exchangeRate: string;
	fee: string;
	path: string[];
	pools: string[];
}

// Types for contract actions
export interface ContractAction {
	functionName: string;
	args: any[];
	value?: string;
}
