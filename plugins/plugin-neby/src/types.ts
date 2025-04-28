import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

/**
 * Result of a token swap operation
 */
export interface SwapResult {
	transactionHash: string;
	fromToken: string;
	toToken: string;
	amountIn: string;
	amountOut: string;
	timestamp: number;
}

/**
 * Result of adding or removing liquidity
 */
export interface LiquidityResult {
	transactionHash: string;
	tokenA: string;
	tokenB: string;
	amountA: string;
	amountB: string;
	liquidity: string;
	timestamp: number;
}

/**
 * Price information for a token pair
 */
export interface PriceInfo {
	tokenA: string;
	tokenB: string;
	poolFee: number;
	price: string;
	updatedAt: number;
}

/**
 * Arbitrage opportunity between pools
 */
export interface ArbitrageOpportunity {
	routeDescription: string;
	profitToken: string;
	estimatedProfit: string;
	confidence: "low" | "medium" | "high";
}

/**
 * Common transaction receipt
 */
export interface TransactionReceipt {
	transactionHash: string;
	status: boolean;
	blockNumber: number;
	events?: Record<string, unknown>;
}

/**
 * Plugin configuration options
 */
export const PluginConfigSchema = z.object({
	network: z.enum(["mainnet", "testnet"]).default("mainnet"),
	privateKey: z.string().optional(),
	walletSeed: z.string().optional(),
	maxSlippage: z.number().default(0.5), // Default 0.5%
	minLiquidity: z.number().default(1000), // Minimum liquidity in USD
	privacyLevel: z.enum(["standard", "high"]).default("high"),
	gasOptimization: z.enum(["low", "medium", "high"]).default("medium"),
	useConfidentialComputing: z.boolean().default(true),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;

/**
 * Main plugin return type
 */
export interface NebyPluginType {
		swap: (
			fromToken: string,
			toToken: string,
			amount: string,
			slippage?: number,
		) => Promise<SwapResult>;

		addLiquidity: (
			tokenA: string,
			tokenB: string,
			amountA: string,
			amountB: string,
		) => Promise<LiquidityResult>;

		removeLiquidity: (
			tokenA: string,
			tokenB: string,
			liquidity: string,
		) => Promise<LiquidityResult>;

		monitorPrices: (
			tokenPairs: Array<[string, string]>,
		) => Promise<PriceInfo[]>;

		getPoolLiquidity: (
			tokenA: string,
			tokenB: string,
			fee?: number,
		) => Promise<string>;

		getPoolInfo: (
			tokenA: string,
			tokenB: string,
			fee?: number,
		) => Promise<Record<string, unknown>>;
	}

/**
 * Plugin factory function type
 */
export type NebyPluginFactory = (
	runtime: IAgentRuntime,
	config?: Partial<PluginConfig>,
) => NebyPluginType;
