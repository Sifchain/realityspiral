import { z } from "zod";

// Available stablecoin tokens on Thorn Protocol
export const STABLECOIN_TOKENS = [
	"USDC",
	"USDT",
	"DAI",
	"BUSD",
	"FRAX",
	"TUSD",
	"USDD",
	"USDP",
	"GUSD",
] as const;

// Privacy levels for swap operations
export const PRIVACY_LEVELS = ["low", "medium", "high"] as const;

// Swap schema for validation
export const SwapSchema = z.object({
	fromToken: z.enum(STABLECOIN_TOKENS),
	toToken: z.enum(STABLECOIN_TOKENS),
	amount: z.string().min(1),
	slippage: z.number().min(0).max(5).default(0.5),
	privacyLevel: z.enum(PRIVACY_LEVELS).default("high"),
});

export interface SwapContent {
	fromToken: (typeof STABLECOIN_TOKENS)[number];
	toToken: (typeof STABLECOIN_TOKENS)[number];
	amount: string;
	slippage: number;
	privacyLevel: (typeof PRIVACY_LEVELS)[number];
}

// Type guard for SwapContent
export const isSwapContent = (object: any): object is SwapContent => {
	return SwapSchema.safeParse(object).success;
};

// Price stability monitoring schema
export const PriceMonitorSchema = z.object({
	tokens: z.array(z.enum(STABLECOIN_TOKENS)),
	alertThreshold: z.number().min(0.001).max(0.1).default(0.01),
	intervalMinutes: z.number().min(1).max(1440).default(30),
});

export interface PriceMonitorContent {
	tokens: Array<(typeof STABLECOIN_TOKENS)[number]>;
	alertThreshold: number;
	intervalMinutes: number;
}

export const isPriceMonitorContent = (
	object: any,
): object is PriceMonitorContent => {
	return PriceMonitorSchema.safeParse(object).success;
};

// Strategy configuration schema
export const StrategySchema = z.object({
	name: z.string().min(1),
	targetToken: z.enum(STABLECOIN_TOKENS),
	sourceTokens: z.array(z.enum(STABLECOIN_TOKENS)).min(1),
	totalBudget: z.string().min(1),
	maxSlippage: z.number().min(0).max(5).default(0.5),
	triggerThreshold: z.number().min(0.001).max(0.1).default(0.005),
	privacyLevel: z.enum(PRIVACY_LEVELS).default("high"),
	isActive: z.boolean().default(true),
});

export interface StrategyContent {
	name: string;
	targetToken: (typeof STABLECOIN_TOKENS)[number];
	sourceTokens: Array<(typeof STABLECOIN_TOKENS)[number]>;
	totalBudget: string;
	maxSlippage: number;
	triggerThreshold: number;
	privacyLevel: (typeof PRIVACY_LEVELS)[number];
	isActive: boolean;
}

export const isStrategyContent = (object: any): object is StrategyContent => {
	return StrategySchema.safeParse(object).success;
};

// Swap result interface
export interface SwapResult {
	fromToken: string;
	toToken: string;
	sentAmount: string;
	receivedAmount: string;
	exchangeRate: string;
	fee: string;
	txHash: string;
	timestamp: number;
	privacyLevel: (typeof PRIVACY_LEVELS)[number];
}

// Price stability info interface
export interface PriceStabilityInfo {
	token: string;
	price: string;
	deviation: number;
	timestamp: number;
	isStable: boolean;
}

// Swap path interface
export interface SwapPath {
	steps: Array<{
		fromToken: string;
		toToken: string;
		poolAddress: string;
		estimatedRate: string;
	}>;
	totalExchangeRate: string;
	estimatedGas: string;
	privacyScore: number;
}

// Liquidity pool interface
export interface LiquidityPool {
	id: string;
	token0: string;
	token1: string;
	reserve0: string;
	reserve1: string;
	fee: string;
	privacyLevel: (typeof PRIVACY_LEVELS)[number];
} 