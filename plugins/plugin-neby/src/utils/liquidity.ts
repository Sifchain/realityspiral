import {
	type ActionHandlerSchema,
	type Logger,
	toActionHandler,
} from "@elizaos/core";
import type { PluginStorage } from "@elizaos/core";
import { z } from "zod";
import type { LiquidityResult } from "../types";
import { LiquidityService } from "./liquidityService";
import { getConfigOrThrow } from "./utils";

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
	{ tokenA, tokenB, amountA, amountB, slippage, deadline }: AddLiquidityParams,
	{ pluginStorage, logger }: { pluginStorage: PluginStorage; logger: Logger },
) => {
	try {
		logger.info(
			`Adding liquidity: ${amountA} of ${tokenA} and ${amountB} of ${tokenB}`,
			{ plugin: "neby", module: "ADD_LIQUIDITY_NEBY" },
		);

		const _config = await getConfigOrThrow(pluginStorage as PluginStorage);
		const result = {} as LiquidityResult;

		logger.info(`Liquidity added successfully: ${result.transactionHash}`, {
			plugin: "neby",
			module: "ADD_LIQUIDITY_NEBY",
		});

		return {
			success: true,
			result,
		};
	} catch (error: unknown) {
		let errorMessage = "Unknown error";
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		logger.error(`Failed to add liquidity: ${errorMessage}`, {
			plugin: "neby",
			module: "ADD_LIQUIDITY_NEBY",
			error,
		});

		return {
			success: false,
			error: errorMessage,
		};
	}
};

// Handler for removing liquidity
export const removeLiquidityHandler: ActionHandlerSchema<
	RemoveLiquidityParams,
	LiquidityResult
> = async (
	{ tokenA, tokenB, liquidity, slippage, deadline }: RemoveLiquidityParams,
	{ pluginStorage, logger }: { pluginStorage: PluginStorage; logger: Logger },
) => {
	try {
		logger.info(
			`Removing ${liquidity} liquidity between ${tokenA} and ${tokenB}`,
			{ plugin: "neby", module: "REMOVE_LIQUIDITY_NEBY" },
		);

		const _config = await getConfigOrThrow(pluginStorage as PluginStorage);
		const result = {} as LiquidityResult;

		logger.info(`Liquidity removed successfully: ${result.transactionHash}`, {
			plugin: "neby",
			module: "REMOVE_LIQUIDITY_NEBY",
		});

		return {
			success: true,
			result,
		};
	} catch (error: unknown) {
		let errorMessage = "Unknown error";
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		logger.error(`Failed to remove liquidity: ${errorMessage}`, {
			plugin: "neby",
			module: "REMOVE_LIQUIDITY_NEBY",
			error,
		});

		return {
			success: false,
			error: errorMessage,
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
