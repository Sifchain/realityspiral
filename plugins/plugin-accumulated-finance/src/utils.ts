import type { IAgentRuntime } from "@elizaos/core";
import * as ethers from "ethers";
import type { SAPPHIRE_MAINNET, SAPPHIRE_TESTNET } from "./constants";
// Helper function to create an ethers provider and signer
export const getProviderAndSigner = async (
	runtime: IAgentRuntime,
	networkConfig: typeof SAPPHIRE_MAINNET | typeof SAPPHIRE_TESTNET,
): Promise<{ provider: ethers.JsonRpcProvider; signer: ethers.Wallet }> => {
	// Create provider
	const provider = new ethers.JsonRpcProvider(networkConfig.RPC_URL);

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
