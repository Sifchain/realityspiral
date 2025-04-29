import {
	type ActionHandlerSchema,
	type Logger,
	toActionHandler,
} from "@elizaos/core";
import type { PluginStorage } from "@elizaos/core";
import { z } from "zod";
import type { ArbitrageOpportunity, PriceInfo } from "../types";
import { findArbitrageOpportunities, getTokenPrice } from "./priceService";
import { getConfigOrThrow } from "./utils";

export const GET_PRICE_NEBY = "get-price-neby";
export const FIND_ARBITRAGE_NEBY = "find-arbitrage-neby";

// Schema for getting token price
const getPriceSchema = z.object({
	tokenAddress: z.string().describe("Address of the token to get price for"),
	baseTokenAddress: z
		.string()
		.optional()
		.describe(
			"Address of the base token to compare against (defaults to USDC)",
		),
});

type GetPriceParams = z.infer<typeof getPriceSchema>;

// Schema for finding arbitrage opportunities
const findArbitrageSchema = z.object({
	tokenAddresses: z
		.array(z.string())
		.optional()
		.describe(
			"Optional list of token addresses to look for arbitrage (default: popular tokens)",
		),
	minProfitPercentage: z
		.number()
		.optional()
		.describe("Minimum profit percentage to consider an opportunity valid"),
	maxHops: z
		.number()
		.optional()
		.describe("Maximum number of hops in the arbitrage path"),
});

type FindArbitrageParams = z.infer<typeof findArbitrageSchema>;

// Handler for getting token price
export const getPriceHandler: ActionHandlerSchema<
	GetPriceParams,
	{
		success: boolean;
		result?: PriceInfo;
		error?: string;
	}
> = async (
	{ tokenAddress, baseTokenAddress }: GetPriceParams,
	{ pluginStorage, logger }: { pluginStorage: PluginStorage; logger: Logger },
) => {
	try {
		logger.info(
			`Getting price for token ${tokenAddress} against ${baseTokenAddress || "USDC"}`,
			{ plugin: "neby", module: "GET_PRICE_NEBY" },
		);

		const _config = await getConfigOrThrow(pluginStorage as PluginStorage);
		const priceInfo = await getTokenPrice(tokenAddress);

		logger.info(`Price retrieved: ${priceInfo.price}`, {
			plugin: "neby",
			module: "GET_PRICE_NEBY",
		});

		return {
			success: true,
			result: priceInfo,
		};
	} catch (error: unknown) {
		let errorMessage = "Unknown error";
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		logger.error(`Failed to get price: ${errorMessage}`, {
			plugin: "neby",
			module: "GET_PRICE_NEBY",
			error,
		});

		return {
			success: false,
			error: errorMessage,
		};
	}
};

// Handler for finding arbitrage opportunities
export const findArbitrageHandler: ActionHandlerSchema<
	FindArbitrageParams,
	{
		success: boolean;
		result?: ArbitrageOpportunity[];
		error?: string;
	}
> = async (
	{ tokenAddresses, minProfitPercentage, maxHops }: FindArbitrageParams,
	{ pluginStorage, logger }: { pluginStorage: PluginStorage; logger: Logger },
) => {
	try {
		logger.info(
			`Finding arbitrage opportunities for ${tokenAddresses?.length || "popular"} tokens`,
			{ plugin: "neby", module: "FIND_ARBITRAGE_NEBY" },
		);

		const _config = await getConfigOrThrow(pluginStorage as PluginStorage);
		const opportunities = await findArbitrageOpportunities();

		logger.info(`Found ${opportunities.length} arbitrage opportunities`, {
			plugin: "neby",
			module: "FIND_ARBITRAGE_NEBY",
		});

		return {
			success: true,
			result: opportunities,
		};
	} catch (error: unknown) {
		let errorMessage = "Unknown error";
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		logger.error(`Failed to find arbitrage opportunities: ${errorMessage}`, {
			plugin: "neby",
			module: "FIND_ARBITRAGE_NEBY",
			error,
		});

		return {
			success: false,
			error: errorMessage,
		};
	}
};

export const getPriceAction = toActionHandler(
	GET_PRICE_NEBY,
	getPriceSchema,
	getPriceHandler,
);

export const findArbitrageAction = toActionHandler(
	FIND_ARBITRAGE_NEBY,
	findArbitrageSchema,
	findArbitrageHandler,
);

export default {
	getPriceAction,
	findArbitrageAction,
};
