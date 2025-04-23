import { ethers } from "ethers";
import { elizaLogger } from "@elizaos/core";

// Type definition matching the Zod schema in index.ts
interface BitProtocolConfig {
	oasisNetwork: string;
	rpcUrl: string;
	privateKey: string; // Assuming private key is passed directly for now
	// Add other config fields if needed by utils
}

/**
 * Initializes ethers provider and signer based on plugin configuration.
 */
export function initializeEthers(config: BitProtocolConfig): {
	provider: ethers.JsonRpcProvider;
	signer: ethers.Wallet;
} {
	try {
		elizaLogger.info(
			`Initializing ethers for Oasis network: ${config.oasisNetwork} via RPC: ${config.rpcUrl}`,
		);

		const provider = new ethers.JsonRpcProvider(config.rpcUrl);

		// IMPORTANT: Handle private keys securely. In a real scenario,
		// this key should come from a secure source (e.g., TEE secret management,
		// environment variable managed by a secure process, or IAgentRuntime settings).
		// Passing it directly in config might be insecure depending on how config is populated.
		if (!config.privateKey) {
			throw new Error("Private key is missing in configuration.");
		}
		// Ensure private key has the 0x prefix
		const pk = config.privateKey.startsWith("0x")
			? config.privateKey
			: `0x${config.privateKey}`;
		const signer = new ethers.Wallet(pk, provider);

		elizaLogger.info(
			`Ethers signer initialized for address: ${signer.address}`,
		);

		return { provider, signer };
	} catch (error: any) {
		elizaLogger.error("Failed to initialize ethers provider/signer:", error);
		throw new Error(`Ethers initialization failed: ${error.message}`);
	}
}

/**
 * Helper function to get a contract instance.
 */
export function getContract(
	address: string,
	abi: ethers.InterfaceAbi,
	signerOrProvider: ethers.Signer | ethers.Provider,
): ethers.Contract {
	try {
		return new ethers.Contract(address, abi, signerOrProvider);
	} catch (error: any) {
		elizaLogger.error(
			`Failed to create contract instance for address ${address}:`,
			error,
		);
		throw new Error(`Contract initialization failed: ${error.message}`);
	}
}

/**
 * Parses a token amount string into its BigInt representation based on decimals.
 */
export async function parseTokenAmount(
	amount: string,
	tokenAddress: string,
	provider: ethers.Provider,
): Promise<bigint> {
	// Use a minimal ERC20 ABI just for decimals
	const minimalErc20Abi = ["function decimals() view returns (uint8)"];
	const tokenContract = new ethers.Contract(
		tokenAddress,
		minimalErc20Abi,
		provider,
	);
	try {
		const decimals = await tokenContract.decimals();
		return ethers.parseUnits(amount, Number(decimals));
	} catch (error) {
		elizaLogger.error(
			`Failed to get decimals for token ${tokenAddress} or parse amount ${amount}:`,
			error,
		);
		// Fallback to default decimals if unable to fetch
		elizaLogger.warn(
			`Falling back to default decimals (18) for token ${tokenAddress}`,
		);
		const DEFAULT_DECIMALS = 18;
		return ethers.parseUnits(amount, DEFAULT_DECIMALS);
	}
}

/**
 * Formats a BigInt token amount into a string based on decimals.
 */
export async function formatTokenAmount(
	amount: bigint,
	tokenAddress: string,
	provider: ethers.Provider,
): Promise<string> {
	// Use a minimal ERC20 ABI just for decimals
	const minimalErc20Abi = ["function decimals() view returns (uint8)"];
	const tokenContract = new ethers.Contract(
		tokenAddress,
		minimalErc20Abi,
		provider,
	);
	try {
		const decimals = await tokenContract.decimals();
		return ethers.formatUnits(amount, Number(decimals));
	} catch (error) {
		elizaLogger.error(
			`Failed to get decimals for token ${tokenAddress} or format amount ${amount}:`,
			error,
		);
		// Fallback to default decimals if unable to fetch
		elizaLogger.warn(
			`Falling back to default decimals (18) for token ${tokenAddress}`,
		);
		const DEFAULT_DECIMALS = 18;
		return ethers.formatUnits(amount, DEFAULT_DECIMALS);
	}
}

// TODO: Add utility function for handling Oasis-specific confidential transactions if needed
// This might involve interacting with the @oasisprotocol/client library
// export async function sendConfidentialTx(...) { ... } 