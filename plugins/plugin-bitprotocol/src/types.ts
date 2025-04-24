import { z } from "zod";

// --- Action Input Schemas --- //

export const SwapInputSchema = z.object({
	fromTokenSymbol: z.string(),
	toTokenSymbol: z.string(),
	amountStr: z.string(),
	slippage: z.number().optional(),
});
export type SwapInput = z.infer<typeof SwapInputSchema>;

export const PrivateSwapInputSchema = SwapInputSchema;
export type PrivateSwapInput = z.infer<typeof PrivateSwapInputSchema>;

export const GetOptimalSwapPathInputSchema = z.object({
	fromTokenSymbol: z.string(),
	toTokenSymbol: z.string(),
	amountStr: z.string(),
});
export type GetOptimalSwapPathInput = z.infer<
	typeof GetOptimalSwapPathInputSchema
>;

// --- Action Result Interfaces --- //

export interface SwapResult {
	transactionHash: string;
	fromAmountFormatted: string;
	estimatedOutputFormatted?: string;
	path?: string[];
	isConfidential?: boolean;
}

export interface PriceStabilityInfo {
	price: string;
	isStable: boolean;
	timestamp: number;
}

export interface SwapPath {
	path: string[];
	estimatedOutput: string;
	formattedOutput?: string;
	inputAmount?: string;
	fromSymbol?: string;
	toSymbol?: string;
}
