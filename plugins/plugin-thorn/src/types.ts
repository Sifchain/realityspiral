import { z } from "zod";

// Available stablecoin tokens on Thorn Protocol
export const AVAILABLE_TOKENS = [
	"ROSE",
	"stROSE",
	"USDC",
	"bitUSDs",
	"USDT",
	"OCEAN(Router)",
	"OCEAN(Celer)",
] as const;

export type AvailableToken = (typeof AVAILABLE_TOKENS)[number];

// Plugin configuration schema for validation
export const PluginConfigSchema = z.object({
	network: z.enum(["mainnet", "testnet"]).default("mainnet"),
	privateKey: z.string().optional(),
	walletAddress: z.string().optional(),
	slippage: z.number().min(0).max(5).default(0.5),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;

// Swap schema for validation
export const SwapSchema = z.object({
	fromToken: z.enum(AVAILABLE_TOKENS),
	toToken: z.enum(AVAILABLE_TOKENS),
	amount: z.string().min(1),
	slippage: z.number().min(0).max(5).default(0.5),
});

export interface SwapContent {
	fromToken: (typeof AVAILABLE_TOKENS)[number];
	toToken: (typeof AVAILABLE_TOKENS)[number];
	amount: string;
	slippage: number;
}

// Type guard for SwapContent
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isSwapContent = (object: any): object is SwapContent => {
	return SwapSchema.safeParse(object).success;
};

// Price stability monitoring schema
export const PriceMonitorSchema = z.object({
	tokens: z.array(z.enum(AVAILABLE_TOKENS)),
	alertThreshold: z.number().min(0.001).max(0.1).default(0.01),
	intervalMinutes: z.number().min(1).max(1440).default(30),
});

export interface PriceMonitorContent {
	tokens: Array<(typeof AVAILABLE_TOKENS)[number]>;
	alertThreshold: number;
	intervalMinutes: number;
}

export const isPriceMonitorContent = (
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	object: any,
): object is PriceMonitorContent => {
	return PriceMonitorSchema.safeParse(object).success;
};

// Strategy configuration schema
export const StrategySchema = z.object({
	name: z.string().min(1),
	targetToken: z.enum(AVAILABLE_TOKENS),
	sourceTokens: z.array(z.enum(AVAILABLE_TOKENS)).min(1),
	totalBudget: z.string().min(1),
	maxSlippage: z.number().min(0).max(5).default(0.5),
	triggerThreshold: z.number().min(0.001).max(0.1).default(0.005),
	isActive: z.boolean().default(true),
});

export interface StrategyContent {
	name: string;
	targetToken: (typeof AVAILABLE_TOKENS)[number];
	sourceTokens: Array<(typeof AVAILABLE_TOKENS)[number]>;
	totalBudget: string;
	maxSlippage: number;
	triggerThreshold: number;
	isActive: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
}

// Liquidity pool interface
export interface LiquidityPool {
	id: string;
	token0: string;
	token1: string;
	reserve0: string;
	reserve1: string;
	fee: string;
}
