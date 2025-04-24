import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ContractHelper } from "@realityspiral/plugin-coinbase";
import { OASIS_NETWORKS, OASIS_NETWORK_IDS } from "../constants";

/**
 * Get the user's wallet address as a string
 */
export const getUserAddressString = async (
	runtime: IAgentRuntime,
	networkId?: string,
): Promise<string> => {
	const network = runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.TESTNET;
	const targetNetworkId =
		networkId ||
		(network === OASIS_NETWORKS.MAINNET
			? OASIS_NETWORK_IDS.MAINNET
			: OASIS_NETWORK_IDS.TESTNET);

	elizaLogger.info("Creating ContractHelper for getUserAddressString", {
		networkId: targetNetworkId,
	});

	const contractHelper = new ContractHelper(runtime);

	try {
		elizaLogger.info("Calling getUserAddress on ContractHelper", {
			networkId: targetNetworkId,
		});
		const walletAddress = await contractHelper.getUserAddress(targetNetworkId);
		elizaLogger.info("Received wallet address", { walletAddress });

		if (!walletAddress) {
			throw new Error(
				"User address string not found. Ensure wallet is connected and configured.",
			);
		}
		return walletAddress;
	} catch (error: unknown) {
		elizaLogger.error(
			"Failed to get user address string from ContractHelper",
			error instanceof Error
				? {
						message: error.message,
						stack: error.stack,
						name: error.name,
					}
				: error,
		);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Could not retrieve user address string: ${errorMessage}`);
	}
};

/**
 * Get the network ID based on the runtime configuration
 */
export const getNetworkId = (runtime: IAgentRuntime): string => {
	const network = runtime.getSetting("OASIS_NETWORK") || OASIS_NETWORKS.TESTNET;
	return network === OASIS_NETWORKS.MAINNET
		? OASIS_NETWORK_IDS.MAINNET
		: OASIS_NETWORK_IDS.TESTNET;
};

/**
 * Create a properly configured ContractHelper instance
 */
export const createContractHelper = (
	runtime: IAgentRuntime,
): ContractHelper => {
	elizaLogger.info("Creating ContractHelper");
	return new ContractHelper(runtime);
};
