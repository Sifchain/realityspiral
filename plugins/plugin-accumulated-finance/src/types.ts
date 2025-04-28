import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

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

// ---- Action Input Schemas ----

// Stake Operation Schema
export const StakeSchema = z.object({
	amount: z.string().min(1),
	receiver: z.string().optional(),
});

export type StakeContent = z.infer<typeof StakeSchema>;

export function isStakeContent(input: unknown): input is StakeContent {
	return StakeSchema.safeParse(input).success;
}

// Unstake Operation Schema
export const UnstakeSchema = z.object({
	amount: z.string().min(1),
	receiver: z.string().optional(),
});

export type UnstakeContent = z.infer<typeof UnstakeSchema>;

export function isUnstakeContent(input: unknown): input is UnstakeContent {
	return UnstakeSchema.safeParse(input).success;
}

// Empty Schema for operations that don't require parameters
export const EmptySchema = z.object({});

export type EmptyContent = z.infer<typeof EmptySchema>;

export function isEmptyContent(input: unknown): input is EmptyContent {
	return EmptySchema.safeParse(input).success;
}

// Wrap Rose Schema
export const WrapRoseSchema = z.object({
	amount: z.string().min(1),
});

export type WrapRoseContent = z.infer<typeof WrapRoseSchema>;

export function isWrapRoseContent(input: unknown): input is WrapRoseContent {
	return WrapRoseSchema.safeParse(input).success;
}

// Unwrap Rose Schema
export const UnwrapRoseSchema = z.object({
	amount: z.string().min(1),
});

export type UnwrapRoseContent = z.infer<typeof UnwrapRoseSchema>;

export function isUnwrapRoseContent(
	input: unknown,
): input is UnwrapRoseContent {
	return UnwrapRoseSchema.safeParse(input).success;
}

// Mint Schema
export const MintSchema = z.object({
	amount: z.string().min(1),
	receiver: z.string().optional(),
});

export type MintContent = z.infer<typeof MintSchema>;

export function isMintContent(input: unknown): input is MintContent {
	return MintSchema.safeParse(input).success;
}

// Approve Schema
export const ApproveSchema = z.object({
	tokenAddress: z.string().min(1),
	spenderAddress: z.string().min(1),
	amount: z.string().min(1),
});

export type ApproveContent = z.infer<typeof ApproveSchema>;

export function isApproveContent(input: unknown): input is ApproveContent {
	return ApproveSchema.safeParse(input).success;
}

// Redeem Schema
export const RedeemSchema = z.object({
	shares: z.string().min(1),
	receiver: z.string().optional(),
	owner: z.string().optional(),
});

export type RedeemContent = z.infer<typeof RedeemSchema>;

export function isRedeemContent(input: unknown): input is RedeemContent {
	return RedeemSchema.safeParse(input).success;
}
