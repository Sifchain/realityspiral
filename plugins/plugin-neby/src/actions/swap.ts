import { type ActionHandlerSchema, toActionHandler } from "@elizaos/core";
import type { PluginStorage } from "@elizaos/core";
import type { Logger } from "@elizaos/core";
import { z } from "zod";
import { executeSwap } from "../services/swapService";
import type { SwapResult } from "../types";
import { getConfigOrThrow } from "../utils";

export const SWAP_NEBY = "swap-neby";

const schema = z.object({
	fromToken: z.string().describe("Address of the token to swap from"),
	toToken: z.string().describe("Address of the token to swap to"),
	amount: z.string().describe("Amount of fromToken to swap"),
	slippage: z
		.number()
		.optional()
		.describe("Maximum slippage allowed for the swap (in percentage)"),
	deadline: z
		.number()
		.optional()
		.describe("Deadline for the transaction (in seconds)"),
});

type SwapParams = z.infer<typeof schema>;

export const handler: ActionHandlerSchema<SwapParams, SwapResult> = async (
	{ fromToken, toToken, amount, slippage, deadline }: SwapParams,
	{ pluginStorage, logger }: { pluginStorage: PluginStorage; logger: Logger },
) => {
	try {
		logger.info(
			`Initiating swap from ${fromToken} to ${toToken} for amount ${amount}`,
			{ plugin: "neby", module: "SWAP_NEBY" },
		);

		const config = await getConfigOrThrow(pluginStorage);
		const result = await executeSwap(
			fromToken,
			toToken,
			amount,
			slippage || config.maxSlippage,
			deadline,
			config,
			logger,
		);

		logger.info(`Swap completed successfully: ${result.transactionHash}`, {
			plugin: "neby",
			module: "SWAP_NEBY",
		});

		return {
			success: true,
			result,
		};
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`Failed to swap tokens: ${errorMessage}`, {
			plugin: "neby",
			module: "SWAP_NEBY",
			error,
		});

		return {
			success: false,
			error: errorMessage,
		};
	}
};

export default toActionHandler(SWAP_NEBY, schema, handler);
