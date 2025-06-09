import { z } from "zod";

// Zod schemas for Neby action parameter extraction

export const SwapActionSchema = z.object({
	fromToken: z
		.string()
		.startsWith("0x")
		.describe("Contract address of the token to swap FROM"),
	toToken: z
		.string()
		.startsWith("0x")
		.describe("Contract address of the token to swap TO"),
	amount: z.string().describe("Amount of fromToken to swap"),
	slippage: z
		.number()
		.optional()
		.default(0.5)
		.describe("Optional maximum slippage percentage (e.g., 0.5)"),
});

export const AddLiquidityActionSchema = z.object({
	tokenA: z
		.string()
		.startsWith("0x")
		.describe("Contract address of the first token"),
	tokenB: z
		.string()
		.startsWith("0x")
		.describe("Contract address of the second token"),
	amountA: z.string().describe("Amount of tokenA in smallest unit"),
	amountB: z.string().describe("Amount of tokenB in smallest unit"),
});

export const RemoveLiquidityActionSchema = z.object({
	tokenA: z
		.string()
		.startsWith("0x")
		.describe("Contract address of the first token"),
	tokenB: z
		.string()
		.startsWith("0x")
		.describe("Contract address of the second token"),
	liquidity: z
		.string()
		.describe("Liquidity amount or NFT ID representing the position"),
});

export const MonitorPricesActionSchema = z.object({
	tokenPairs: z
		.array(z.array(z.string().startsWith("0x")).length(2))
		.describe(
			"Array of token address pairs to monitor, e.g., [['0xAddrA', '0xAddrB'], ['0xAddrC', '0xAddrD']]",
		),
});

export const GetPoolDetailsActionSchema = z.object({
	tokenA: z
		.string()
		.startsWith("0x")
		.describe("Contract address of the first token"),
	tokenB: z
		.string()
		.startsWith("0x")
		.describe("Contract address of the second token"),
	fee: z
		.number()
		.optional()
		.default(3000)
		.describe("Optional pool fee tier (e.g., 500, 3000, 10000)"),
});
