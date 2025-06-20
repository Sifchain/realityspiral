import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import type { ContractHelper } from "@realityspiral/plugin-coinbase";
import { RoflService } from "@realityspiral/plugin-rofl";
import { ethers } from "ethers";
import { NETWORK_CONFIG } from "./constants";

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
		if (Number.isNaN(decimals) || decimals < 0 || decimals > 255) {
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
				formattedAmount += `.${fractionalStr}`;
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

// Helper function to create an ethers provider and signer
export const getProviderAndSigner = async (
	runtime: IAgentRuntime,
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	networkConfig: any,
): Promise<{ provider: ethers.JsonRpcProvider; signer: ethers.Wallet }> => {
	// Create provider
	const provider = new ethers.JsonRpcProvider(networkConfig.RPC_URL);
	// const provider = new ethers.JsonRpcProvider(
	// 	NETWORK_CONFIG.OASIS_SAPPHIRE.rpcUrl,
	// );

	// Get private key from environment variables or runtime settings
	let privateKey =
		(runtime.getSetting("WALLET_PRIVATE_KEY") as string) ||
		process.env.WALLET_PRIVATE_KEY;

	// If no private key is set, use ROFL service to generate one based on agent ID
	if (!privateKey) {
		const roflService = new RoflService();
		const agentId = runtime.agentId;

		if (!agentId) {
			throw new Error(
				"Agent ID not found. Cannot generate wallet without agent ID.",
			);
		}

		try {
			const wallet = await roflService.getAgentWallet(agentId);
			privateKey = wallet.privateKey;
		} catch (error) {
			throw new Error(
				`Failed to generate wallet using ROFL service: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	// Create signer
	const signer = new ethers.Wallet(privateKey as string, provider);

	return { provider, signer };
};
