import { type ActionHandlerSchema, toActionHandler } from "@eliza-os/core";
import type { PluginStorage } from "@eliza-os/plugin-runtime";
import { z } from "zod";
import { addLiquidity, removeLiquidity } from "../services/liquidityService";
import type { LiquidityResult } from "../types";
import { getConfigOrThrow } from "../utils";

export const ADD_LIQUIDITY_NEBY = "add-liquidity-neby";
export const REMOVE_LIQUIDITY_NEBY = "remove-liquidity-neby";

// Schema for adding liquidity
const addLiquiditySchema = z.object({
	tokenA: z.string().describe("Address of the first token"),
	tokenB: z.string().describe("Address of the second token"),
	amountA: z.string().describe("Amount of tokenA to add"),
	amountB: z.string().describe("Amount of tokenB to add"),
	slippage: z
		.number()
		.optional()
		.describe("Maximum slippage allowed (in percentage)"),
	deadline: z
		.number()
		.optional()
		.describe("Deadline for the transaction (in seconds)"),
});

type AddLiquidityParams = z.infer<typeof addLiquiditySchema>;

// Schema for removing liquidity
const removeLiquiditySchema = z.object({
	tokenA: z.string().describe("Address of the first token"),
	tokenB: z.string().describe("Address of the second token"),
	liquidity: z.string().describe("Amount of liquidity tokens to remove"),
	slippage: z
		.number()
		.optional()
		.describe("Maximum slippage allowed (in percentage)"),
	deadline: z
		.number()
		.optional()
		.describe("Deadline for the transaction (in seconds)"),
});

type RemoveLiquidityParams = z.infer<typeof removeLiquiditySchema>;

// Handler for adding liquidity
export const addLiquidityHandler: ActionHandlerSchema<
	AddLiquidityParams,
	LiquidityResult
> = async (
	{ tokenA, tokenB, amountA, amountB, slippage, deadline },
	{ pluginStorage, logger },
) => {
	try {
		logger.info(
			`Adding liquidity: ${amountA} of ${tokenA} and ${amountB} of ${tokenB}`,
			{ plugin: "neby", module: "ADD_LIQUIDITY_NEBY" },
		);

		const config = await getConfigOrThrow(pluginStorage as PluginStorage);
		const result = await addLiquidity(
			tokenA,
			tokenB,
			amountA,
			amountB,
			slippage || config.maxSlippage,
			deadline,
			config,
			logger,
		);

		logger.info(`Liquidity added successfully: ${result.transactionHash}`, {
			plugin: "neby",
			module: "ADD_LIQUIDITY_NEBY",
		});

		return {
			success: true,
			result,
		};
	} catch (error) {
		logger.error(`Failed to add liquidity: ${error.message}`, {
			plugin: "neby",
			module: "ADD_LIQUIDITY_NEBY",
			error,
		});

		return {
			success: false,
			error: error.message,
		};
	}
};

// Handler for removing liquidity
export const removeLiquidityHandler: ActionHandlerSchema<
	RemoveLiquidityParams,
	LiquidityResult
> = async (
	{ tokenA, tokenB, liquidity, slippage, deadline },
	{ pluginStorage, logger },
) => {
	try {
		logger.info(
			`Removing ${liquidity} liquidity between ${tokenA} and ${tokenB}`,
			{ plugin: "neby", module: "REMOVE_LIQUIDITY_NEBY" },
		);

		const config = await getConfigOrThrow(pluginStorage as PluginStorage);
		const result = await removeLiquidity(
			tokenA,
			tokenB,
			liquidity,
			slippage || config.maxSlippage,
			deadline,
			config,
			logger,
		);

		logger.info(`Liquidity removed successfully: ${result.transactionHash}`, {
			plugin: "neby",
			module: "REMOVE_LIQUIDITY_NEBY",
		});

		return {
			success: true,
			result,
		};
	} catch (error) {
		logger.error(`Failed to remove liquidity: ${error.message}`, {
			plugin: "neby",
			module: "REMOVE_LIQUIDITY_NEBY",
			error,
		});

		return {
			success: false,
			error: error.message,
		};
	}
};

export const addLiquidityAction = toActionHandler(
	ADD_LIQUIDITY_NEBY,
	addLiquiditySchema,
	addLiquidityHandler,
);

export const removeLiquidityAction = toActionHandler(
	REMOVE_LIQUIDITY_NEBY,
	removeLiquiditySchema,
	removeLiquidityHandler,
);

export default {
	addLiquidityAction,
	removeLiquidityAction,
};
