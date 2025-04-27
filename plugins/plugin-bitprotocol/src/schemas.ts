import { z } from "zod";

// Valid token symbols available on BitProtocol
export const validTokenSymbols = [
	"BitUSD",
	"ROSE",
	"wstROSE",
	"BIT",
	"mTBill",
] as const;

// Schema for token symbols
export const TokenSymbolSchema = z.enum(validTokenSymbols);
export type TokenSymbol = z.infer<typeof TokenSymbolSchema>;

// Swap schema
export const SwapSchema = z.object({
	fromTokenSymbol: TokenSymbolSchema,
	toTokenSymbol: TokenSymbolSchema,
	amountStr: z.string().regex(/^\d*\.?\d+$/),
	slippage: z.number().optional(),
});

// Private swap schema (same as swap schema)
export const PrivateSwapSchema = SwapSchema;

// Optimal path schema
export const GetOptimalPathSchema = z.object({
	fromTokenSymbol: TokenSymbolSchema,
	toTokenSymbol: TokenSymbolSchema,
	amountStr: z
		.string()
		.regex(/^\d*\.?\d+$/)
		.optional(),
});

// Price stability schema
export const PriceStabilitySchema = z.object({
	tokenSymbol: TokenSymbolSchema.optional().default("BitUSD" as const),
});

// Input types inferred from schemas
export type SwapInput = z.infer<typeof SwapSchema>;
export type PrivateSwapInput = z.infer<typeof PrivateSwapSchema>;
export type GetOptimalPathInput = z.infer<typeof GetOptimalPathSchema>;
export type PriceStabilityInput = z.infer<typeof PriceStabilitySchema>;

// Result types
export type SwapResult = {
	transactionHash: string;
	fromAmountFormatted: string;
	estimatedOutputFormatted: string;
	path: TokenSymbol[];
};

export type PrivateSwapResult = SwapResult & {
	isConfidential: boolean;
};

export type OptimalPathResult = {
	path: TokenSymbol[];
	estimatedOutput: string;
	formattedOutput: string;
	inputAmount: string;
	fromSymbol: TokenSymbol;
	toSymbol: TokenSymbol;
};

export type PriceStabilityResult = {
	price: string;
	isStable: boolean;
	timestamp: number;
};
