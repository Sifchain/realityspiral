import { z } from "zod";

export const DepositToGateSchema = z.object({
	tokenSymbol: z.string(),
	amount: z.string(),
	privateKey: z.string(),
});

export const PlaceMarketOrderSchema = z.object({
	instrumentSymbol: z.string(),
	side: z.enum(["LONG", "SHORT"]),
	quoteAmount: z.string(),
	leverage: z.string(),
	privateKey: z.string(),
});

export const ClosePositionSchema = z.object({
	instrumentSymbol: z.string(),
	privateKey: z.string(),
});

export const WithdrawFromGateSchema = z.object({
	tokenSymbol: z.string(),
	amount: z.string(),
	privateKey: z.string(),
});

export const GetPortfolioSchema = z.object({
	walletAddress: z.string(),
});

export type DepositToGateContent = z.infer<typeof DepositToGateSchema>;
export type PlaceMarketOrderContent = z.infer<typeof PlaceMarketOrderSchema>;
export type ClosePositionContent = z.infer<typeof ClosePositionSchema>;
export type WithdrawFromGateContent = z.infer<typeof WithdrawFromGateSchema>;
export type GetPortfolioContent = z.infer<typeof GetPortfolioSchema>;

export const isDepositToGateContent = (
	content: any,
): content is DepositToGateContent => {
	return DepositToGateSchema.safeParse(content).success;
};

export const isPlaceMarketOrderContent = (
	content: any,
): content is PlaceMarketOrderContent => {
	return PlaceMarketOrderSchema.safeParse(content).success;
};

export const isClosePositionContent = (
	content: any,
): content is ClosePositionContent => {
	return ClosePositionSchema.safeParse(content).success;
};

export const isWithdrawFromGateContent = (
	content: any,
): content is WithdrawFromGateContent => {
	return WithdrawFromGateSchema.safeParse(content).success;
};

export const isGetPortfolioContent = (
	content: any,
): content is GetPortfolioContent => {
	return GetPortfolioSchema.safeParse(content).success;
};
