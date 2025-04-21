import { z } from "zod";
import type { IAgentRuntime } from "@elizaos/core";

/**
 * Result of a staking operation
 */
export interface StakingResult {
	transactionHash: string;
	stakedAmount: string;
	timestamp: number;
}

/**
 * Information about staking rewards
 */
export interface RewardInfo {
	pendingRewards: string;
	claimedRewards: string;
	lastClaimTimestamp?: number;
}

/**
 * Staking strategy definition
 */
export interface Strategy {
	id: string;
	name: string;
	description: string;
	riskLevel?: "low" | "medium" | "high";
	estimatedApy?: string;
	lockupPeriod?: string;
}

/**
 * Transaction receipt from blockchain operations
 */
export interface TransactionReceipt {
	transactionHash: string;
	status: boolean;
	blockNumber: number;
	events?: Record<string, any>;
}

/**
 * Plugin configuration options
 */
export const PluginConfigSchema = z.object({
	network: z.enum(["mainnet", "testnet"]).default("mainnet"),
	privateKey: z.string().optional(),
	walletSeed: z.string().optional(),
	autoApprove: z.boolean().default(false),
	stakingStrategy: z.enum(["default"]).default("default"),
	privacyLevel: z.enum(["standard", "high"]).default("standard"),
	useConfidentialComputing: z.boolean().default(true),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;

/**
 * Main plugin return type
 */
export interface AccumulatedFinancePluginType {
	stake: (amount: string, receiver?: string) => Promise<StakingResult>;
	unstake: (amount: string, receiver?: string) => Promise<TransactionReceipt>;
	getRewards: () => Promise<RewardInfo>;
	claimRewards: () => Promise<TransactionReceipt>;
	getStakingStrategies: () => Promise<Strategy[]>;
	getStakedBalance: () => Promise<string>;
	wrapRose: (amount: string) => Promise<TransactionReceipt>;
	unwrapRose: (amount: string) => Promise<TransactionReceipt>;
}

/**
 * Plugin factory function type
 */
export type AccumulatedFinancePluginFactory = (
	runtime: IAgentRuntime,
	config?: Partial<PluginConfig>,
) => AccumulatedFinancePluginType; 