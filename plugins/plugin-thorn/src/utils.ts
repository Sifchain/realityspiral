import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import * as ethers from "ethers";
import { type OASIS_NETWORKS, OASIS_RPC_URLS } from "./constants";

// Helper function to create an ethers provider and signer
export const getProviderAndSigner = async (
	runtime: IAgentRuntime,
	network: keyof typeof OASIS_NETWORKS,
): Promise<{ provider: ethers.JsonRpcProvider; signer: ethers.Wallet }> => {
	// Create provider
	const provider = new ethers.JsonRpcProvider(OASIS_RPC_URLS[network]);

	// Get private key from environment variables or runtime settings
	const privateKey =
		(runtime.getSetting("WALLET_PRIVATE_KEY") as string) ||
		process.env.WALLET_PRIVATE_KEY;

	if (!privateKey) {
		throw new Error(
			"Wallet private key not found. Ensure it is configured in runtime settings or environment variables.",
		);
	}

	// Create signer
	const signer = new ethers.Wallet(privateKey, provider);

	return { provider, signer };
};

// Helper function to convert decimal string amount to wei string
export const convertToWeiString = (
	decimalAmount: string,
	decimals = 18,
): string => {
	try {
		// Handle potential empty string or invalid input before parsing
		if (
			!decimalAmount ||
			typeof decimalAmount !== "string" ||
			Number.isNaN(Number.parseFloat(decimalAmount))
		) {
			throw new Error(
				`Invalid input: "${decimalAmount}" is not a valid decimal number string.`,
			);
		}
		return ethers.parseUnits(decimalAmount, decimals).toString();
	} catch (e: unknown) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		elizaLogger.error("Failed to parse decimal amount to wei", {
			decimalAmount,
			decimals,
			error: errorMsg,
		});
		// Throw a more specific error for upstream handling
		throw new Error(
			`Invalid amount format: "${decimalAmount}". Could not convert to base units (${decimals} decimals). Reason: ${errorMsg}`,
		);
	}
};
