import { elizaLogger } from "@elizaos/core";
import type { ContractHelper } from "@realityspiral/plugin-coinbase";
import { ethers } from "ethers";
import type * as pino from "pino";
import { ERC20_ABI } from "../constants";

/**
 * Utility functions for blockchain interactions
 */

/**
 * Attempts to return the checksummed version of an address.
 * Returns the original address if checksumming fails (e.g., for non-standard formats).
 * @param address The address string
 * @param logger Optional logger instance
 * @returns Checksummed address or original address
 */
export function getChecksummedAddress(
	address: string,
	logger: pino.Logger<string, boolean> = elizaLogger,
): string {
	try {
		return ethers.getAddress(address);
	} catch (error: unknown) {
		// Log a warning if checksumming fails, but return the original address
		logger.warn(
			`Failed to checksum address ${address}. Using original. Error: ${error instanceof Error ? error.message : String(error)}`,
		);
		return address;
	}
}

/**
 * Calculate minimum amount based on input amount and slippage percentage
 * @param amount The input amount as a string
 * @param slippagePercent The slippage percentage (0.5 = 0.5%)
 * @returns The minimum acceptable amount as a string
 */
export function calculateMinAmount(
	amount: string,
	slippagePercent: number,
): string {
	try {
		// Convert to basis points (0.5% = 50 basis points)
		const slippageBasisPoints = Math.floor(slippagePercent * 100);
		const remainingBasisPoints = 10000 - slippageBasisPoints;

		// Calculate minimum amount using ethers v6
		const amountBN = ethers.parseUnits(amount, 0);
		const minAmountBN =
			(amountBN * BigInt(remainingBasisPoints)) / BigInt(10000);

		return minAmountBN.toString();
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to calculate min amount: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Get MaxUint128 value for use with Uniswap V3 collect function
 * @returns MaxUint128 as string
 */
export function getMaxUint128(): string {
	try {
		return (BigInt(2) ** BigInt(128) - BigInt(1)).toString();
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to calculate MaxUint128: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Sort token addresses for Uniswap V3 pool formation (lower address first)
 * @param tokenA First token address
 * @param tokenB Second token address
 * @returns Sorted token addresses [token0, token1]
 */
export function sortTokens(tokenA: string, tokenB: string): [string, string] {
	try {
		if (tokenA.toLowerCase() < tokenB.toLowerCase()) {
			return [tokenA, tokenB];
		}
		return [tokenB, tokenA];
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to sort tokens: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Calculate deadline timestamp for transactions
 * @param seconds Number of seconds from now (default: 1800 = 30 minutes)
 * @returns Unix timestamp deadline
 */
export function getDeadline(seconds = 1800): number {
	return Math.floor(Date.now() / 1000) + seconds;
}

// Cache for token details to avoid repeated calls
const tokenCache: Record<string, { symbol: string; decimals: number }> = {};

// API endpoints for Neby Exchange
export const ENDPOINTS = {
	dex: "https://graph.api.neby.exchange/dex",
	blocks: "https://graph.api.neby.exchange/blocks",
	harvester: "https://graph.api.neby.exchange/harvester",
	liquidityStaker: "https://graph.api.neby.exchange/liquidity-position-staker",
	nebyStaker: "https://graph.api.neby.exchange/neby",
};

/**
 * Gets token details (symbol and decimals)
 */
export const getTokenDetails = async (
	tokenAddress: string,
	contractHelper: ContractHelper,
	networkId: string,
	logger: pino.Logger<string, boolean> = elizaLogger,
): Promise<{ symbol: string; decimals: number }> => {
	// Check cache first
	const cacheKey = `${tokenAddress}-${networkId}`;
	if (tokenCache[cacheKey]) {
		return tokenCache[cacheKey];
	}

	try {
		// Get symbol and decimals using contractHelper
		const [symbol, decimals] = await Promise.all([
			contractHelper.invokeContract({
				networkId,
				contractAddress: tokenAddress,
				method: "symbol",
				args: [],
				abi: ERC20_ABI,
			}),
			contractHelper.invokeContract({
				networkId,
				contractAddress: tokenAddress,
				method: "decimals",
				args: [],
				abi: ERC20_ABI,
			}),
		]);

		// Cache the result
		tokenCache[cacheKey] = {
			symbol,
			decimals: Number(decimals),
		};
		return tokenCache[cacheKey];
	} catch (error) {
		logger.error(
			`Error fetching token details for ${tokenAddress}: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
};

/**
 * Formats an amount based on token decimals
 */
export const formatTokenAmount = (amount: bigint, decimals: number): string => {
	return ethers.formatUnits(amount, decimals);
};

/**
 * Parses a string amount to BigNumber based on token decimals
 */
export const parseTokenAmount = (amount: string, decimals: number): bigint => {
	return ethers.parseUnits(amount, decimals);
};

/**
 * Calculates price from sqrtPriceX96 value
 * In Uniswap V3, price is stored as sqrt(price) * 2^96
 */
export const calculatePriceFromSqrtPriceX96 = (
	sqrtPriceX96: bigint,
	baseTokenDecimals: number,
	quoteTokenDecimals: number,
): number => {
	// Calculate price = (sqrtPrice / 2^96) ^ 2
	const price = (sqrtPriceX96 * sqrtPriceX96) / BigInt(2) ** BigInt(192);

	// Adjust for token decimals
	const decimalAdjustment = 10 ** (baseTokenDecimals - quoteTokenDecimals);

	// Convert to number and adjust for decimals
	return Number(price) * decimalAdjustment;
};
