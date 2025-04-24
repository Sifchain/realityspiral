import { elizaLogger } from "@elizaos/core";
import type { ContractHelper } from "@realityspiral/plugin-coinbase";

const DEFAULT_DECIMALS = 18;
const minimalErc20AbiForDecimals = [
	{
		constant: true,
		inputs: [],
		name: "decimals",
		outputs: [{ type: "uint8" }],
		type: "function",
	},
];

/**
 * Fetches token decimals using ContractHelper, falling back to a default.
 */
async function getTokenDecimals(
	tokenAddress: string,
	contractHelper: ContractHelper,
	networkId: string,
): Promise<number> {
	try {
		elizaLogger.debug(
			`Fetching decimals for token ${tokenAddress} on network ${networkId}`,
		);
		const decimalsResult = await contractHelper.readContract({
			networkId: networkId,
			contractAddress: tokenAddress,
			method: "decimals",
			args: [],
			abi: minimalErc20AbiForDecimals,
		});
		const decimals = Number(decimalsResult);
		elizaLogger.debug(`Token ${tokenAddress} decimals: ${decimals}`);
		// Check if decimals is a valid number, otherwise fallback
		if (isNaN(decimals) || decimals < 0 || decimals > 255) {
			elizaLogger.warn(
				`Invalid decimals value (${decimalsResult}) received for token ${tokenAddress}. Falling back.`,
			);
			return DEFAULT_DECIMALS;
		}
		return decimals;
	} catch (error: unknown) {
		elizaLogger.error(
			`Failed to get decimals via ContractHelper for token ${tokenAddress}:`,
			error,
		);
		elizaLogger.warn(
			`Falling back to default decimals (${DEFAULT_DECIMALS}) for token ${tokenAddress}`,
		);
		return DEFAULT_DECIMALS;
	}
}

/**
 * Parses a token amount string into its BigInt representation based on decimals,
 * fetching decimals using ContractHelper.
 */
export async function parseTokenAmount(
	amount: string,
	tokenAddress: string,
	contractHelper: ContractHelper,
	networkId: string,
): Promise<bigint> {
	try {
		const decimals = await getTokenDecimals(
			tokenAddress,
			contractHelper,
			networkId,
		);
		const [whole, fraction = ""] = amount.split(".");
		// Ensure fraction does not exceed decimals precision
		const trimmedFraction = fraction.slice(0, decimals);
		const paddedFraction = trimmedFraction.padEnd(decimals, "0");
		const wei =
			BigInt(whole) * BigInt(10) ** BigInt(decimals) +
			BigInt(paddedFraction || "0");
		return wei;
	} catch (error) {
		elizaLogger.error(`Failed to parse token amount ${amount}:`, error);
		throw new Error(`Invalid token amount format or parsing error: ${amount}`);
	}
}

/**
 * Formats a BigInt token amount into a string based on decimals,
 * fetching decimals using ContractHelper.
 */
export async function formatTokenAmount(
	amount: bigint,
	tokenAddress: string,
	contractHelper: ContractHelper,
	networkId: string,
): Promise<string> {
	try {
		const decimals = await getTokenDecimals(
			tokenAddress,
			contractHelper,
			networkId,
		);

		const divisor = BigInt(10) ** BigInt(decimals);
		const integerPart = amount / divisor;
		const fractionalPart = amount % divisor;

		let formattedAmount = integerPart.toString();

		if (fractionalPart > BigInt(0)) {
			let fractionalStr = fractionalPart.toString().padStart(decimals, "0");
			fractionalStr = fractionalStr.replace(/0+$/, ""); // Remove trailing zeros
			if (fractionalStr.length > 0) {
				formattedAmount += "." + fractionalStr;
			}
		}

		return formattedAmount;
	} catch (error) {
		elizaLogger.error(
			`Failed to format token amount ${amount.toString()}:`,
			error,
		);
		// Fallback: return the raw amount as a string if formatting fails
		return amount.toString();
	}
}

// TODO: Add utility function for handling Oasis-specific confidential transactions if needed
// This might involve interacting with the @oasisprotocol/client library or specific ContractHelper features