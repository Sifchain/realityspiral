import { z } from "zod";

// Define valid token symbols based on constants.ts
const validTokenSymbols = ["BitUSD", "ROSE", "wstROSE"] as const;

// --- Swap Types ---
export type SwapInput = {
	fromTokenSymbol: string;
	toTokenSymbol: string;
	amountStr: string;
	slippage?: number;
};

export const SwapInputSchema = z.object({
	fromTokenSymbol: z
		.string()
		.describe(
			"Symbol of the token to sell (e.g., 'ROSE', 'BitUSD', 'wstROSE')",
		),
	toTokenSymbol: z.string().describe("Symbol of the token to buy"),
	amountStr: z
		.string()
		.describe(
			"The amount of the 'from' token to sell, as a string (e.g., '0.01', '0.5')",
		),
	slippage: z
		.number()
		.optional()
		.describe("Maximum acceptable slippage percentage (e.g., 0.005 for 0.5%)"),
});

export type SwapResult = {
	transactionHash: string;
	fromAmountFormatted: string;
	estimatedOutputFormatted: string;
	path: string[];
	isConfidential?: boolean;
};

// --- Private Swap Types ---
export type PrivateSwapInput = SwapInput;
export const PrivateSwapInputSchema = SwapInputSchema;

// --- Get Optimal Path Types ---
export type GetOptimalSwapPathInput = {
	fromTokenSymbol: string;
	toTokenSymbol: string;
	amountStr?: string;
};

export const GetOptimalSwapPathInputSchema = z.object({
	fromTokenSymbol: z
		.string()
		.describe(
			"Symbol of the token to start with (e.g., 'ROSE', 'BitUSD', 'wstROSE')",
		),
	toTokenSymbol: z.string().describe("Symbol of the token to end with"),
	amountStr: z
		.string()
		.optional()
		.describe(
			"The amount of the 'from' token to swap, as a string (e.g., '0.01', '0.5')",
		),
});

export type SwapPath = {
	path: string[];
	estimatedOutput: string;
	formattedOutput: string;
	inputAmount: string;
	fromSymbol: string;
	toSymbol: string;
};

// --- Price Stability Monitoring Types ---
export type PriceStabilityInput = {
	tokenSymbol?: string;
};

export const PriceStabilityInputSchema = z.object({
	tokenSymbol: z
		.string()
		.optional()
		.describe("Symbol of the token to check stability (e.g., 'BitUSD')"),
});

export type PriceStabilityInfo = {
	price: string;
	isStable?: boolean;
	timestamp?: number;
};

// --- Token Registry ---
// This would be a mapping of token symbols to addresses
export type TokenAddresses = {
	[symbol: string]: string;
};

// --- BitProtocol Contract Addresses ---
export type BitProtocolContracts = {
	Router: string;
	TroveManager_ROSE: string;
	TroveManager_wstROSE: string;
	BitVault: string;
	Factory: string;
	PriceFeed: string;
};

// --- Network Configuration ---
export type NetworkConfig = {
	[networkName: string]: {
		chainId: number;
		rpcUrl: string;
		name: string;
		explorer?: string;
	};
};

// --- Privacy Configuration ---
export type PrivacyConfig = {
	TEE_ENABLED: boolean;
	MINIMUM_GAS_FOR_PRIVACY: number;
};

/**
 * Type definitions for BitProtocol plugin
 */

// Base schema for token swap parameters
const tokenSwapBaseSchema = z.object({
	fromTokenSymbol: z.string().describe("Symbol of the token to sell"),
	toTokenSymbol: z.string().describe("Symbol of the token to buy"),
	amountStr: z
		.string()
		.describe("Amount of the 'from' token to sell as a string"),
	slippage: z
		.number()
		.optional()
		.describe("Maximum acceptable slippage percentage (e.g., 0.005 for 0.5%)"),
});

// Schema for standard token swap
export const swapSchema = tokenSwapBaseSchema;
export type SwapParams = z.infer<typeof swapSchema>;

// Schema for private token swap
export const privateSwapSchema = tokenSwapBaseSchema;
export type PrivateSwapParams = z.infer<typeof privateSwapSchema>;

// Schema for getting optimal swap path
export const getPathSchema = z.object({
	fromTokenSymbol: z.string().describe("Symbol of the token to start with"),
	toTokenSymbol: z.string().describe("Symbol of the token to end with"),
	amountStr: z
		.string()
		.optional()
		.describe("Amount of the 'from' token to swap"),
});
export type GetPathParams = z.infer<typeof getPathSchema>;

// Response schemas
export const swapResponseSchema = z.object({
	success: z.boolean(),
	txHash: z.string().optional(),
	error: z.string().optional(),
	amount: z.string().optional(),
});
export type SwapResponse = z.infer<typeof swapResponseSchema>;

export const pathResponseSchema = z.object({
	path: z.array(z.string()),
	expectedOutput: z.string().optional(),
	error: z.string().optional(),
});
export type PathResponse = z.infer<typeof pathResponseSchema>;
