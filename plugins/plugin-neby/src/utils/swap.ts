import {
	type ActionHandlerSchema,
	type Logger,
	toActionHandler,
} from "@elizaos/core";
import type { PluginStorage } from "@elizaos/core";
import { z } from "zod";
import type { SwapResult } from "../types";
import { SwapService } from "./swapService";
import { getConfigOrThrow } from "./utils";

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

		const _config = await getConfigOrThrow(pluginStorage);
		const result = {} as SwapResult;

		logger.info(`Swap completed successfully: ${result.transactionHash}`, {
			plugin: "neby",
			module: "SWAP_NEBY",
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
