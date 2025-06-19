import type { IAgentRuntime } from "@elizaos/core";
import * as ethers from "ethers";
import { RoflService } from "@realityspiral/plugin-rofl";
import type { SAPPHIRE_MAINNET, SAPPHIRE_TESTNET } from "./constants";

// Helper function to create an ethers provider and signer
export const getProviderAndSigner = async (
	runtime: IAgentRuntime,
	networkConfig: typeof SAPPHIRE_MAINNET | typeof SAPPHIRE_TESTNET,
): Promise<{ provider: ethers.JsonRpcProvider; signer: ethers.Wallet }> => {
	// Create provider
	const provider = new ethers.JsonRpcProvider(networkConfig.RPC_URL);

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
