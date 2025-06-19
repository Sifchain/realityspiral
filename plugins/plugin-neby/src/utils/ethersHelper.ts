import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ethers } from "ethers";
import { SAPPHIRE_MAINNET, SAPPHIRE_TESTNET } from "../constants";
import type { TransactionReceipt } from "../types"; // Assuming TransactionReceipt type is defined
import { RoflService } from "@realityspiral/plugin-rofl";

// Helper to handle potential BigInt values in results (recursive)
// biome-ignore lint/suspicious/noExplicitAny: Needed for generic serialization
const serializeResult = (value: any): any => {
	if (typeof value === "bigint") {
		return value.toString();
	}
	// Handle ethers Result objects (arrays with named properties)
	if (Array.isArray(value) && typeof value === "object") {
		const serializedArray = value.map(serializeResult);
		// Explicitly type resultObject to allow string keys
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		const resultObject: Record<string, any> = { ...serializedArray }; // Copy array indices
		// Copy named properties
		for (const key of Object.keys(value)) {
			// Check if key is not a standard array index
			if (Number.isNaN(Number(key))) {
				// Accessing the original value array/object with a potential string key
				// Need to assert value as any here if TS complains about string index on array type
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				resultObject[key] = serializeResult((value as any)[key]);
			}
		}
		return resultObject;
	}
	if (Array.isArray(value)) {
		return value.map(serializeResult);
	}
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value).map(([k, v]) => [k, serializeResult(v)]),
		);
	}
	return value;
};

/**
 * Gets an ethers Provider instance for the specified network.
 */
export const getProvider = (networkId: string): ethers.JsonRpcProvider => {
	const networkConfig =
		networkId === "23294" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;
	const rpcUrl = networkConfig.RPC_URL;

	if (!rpcUrl) {
		elizaLogger.error(`RPC URL for network ID ${networkId} is not defined.`);
		throw new Error(`RPC URL for network ID ${networkId} not configured.`);
	}
	elizaLogger.debug(
		`Creating JsonRpcProvider for network ${networkId} (${rpcUrl})`,
	);
	return new ethers.JsonRpcProvider(rpcUrl);
};

/**
 * Gets an ethers Signer instance for the user's wallet.
 * Assumes the private key is available via runtime settings.
 */
export const getSigner = async (
	runtime: IAgentRuntime,
	networkId: string,
): Promise<ethers.Wallet> => {
	const provider = getProvider(networkId);

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

	try {
		const signer = new ethers.Wallet(privateKey, provider);
		elizaLogger.debug(`Signer created for address: ${signer.address}`);
		return signer;
	} catch (error: unknown) {
		elizaLogger.error("Failed to create Wallet signer from private key", {
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error(
			`Failed to initialize signer: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
};

/**
 * Gets the user's wallet address associated with the runtime.
 */
export const getUserAddress = async (
	runtime: IAgentRuntime,
	networkId: string,
): Promise<string> => {
	try {
		const signer = await getSigner(runtime, networkId);
		const address = await signer.getAddress();
		elizaLogger.debug(`Retrieved user address: ${address}`);
		return address;
	} catch (error: unknown) {
		elizaLogger.error("Failed to get user address", {
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error(
			`Failed to get user address: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
};

/**
 * Reads data from a smart contract using ethers.js.
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const readContract = async <T = any>({
	networkId,
	contractAddress,
	abi,
	method,
	args = [],
}: {
	runtime: IAgentRuntime; // Keep runtime for consistency, though not strictly needed for read
	networkId: string;
	contractAddress: string;
	abi: ethers.InterfaceAbi;
	method: string;
	args?: unknown[];
}): Promise<T> => {
	elizaLogger.debug("Reading contract using ethersHelper.readContract", {
		networkId,
		contractAddress,
		method,
		args,
	});
	const provider = getProvider(networkId);
	const contract = new ethers.Contract(contractAddress, abi, provider);

	try {
		const contractMethod = contract[method] as ethers.ContractMethod<
			// biome-ignore lint/suspicious/noExplicitAny: Accessing contract method dynamically
			any[],
			// biome-ignore lint/suspicious/noExplicitAny: Accessing contract method dynamically
			any,
			// biome-ignore lint/suspicious/noExplicitAny: Accessing contract method dynamically
			any
		>;
		if (!contractMethod) {
			throw new Error(`Method '${method}' not found on contract ABI.`);
		}

		// Determine if static call is appropriate (for non-view/pure methods called as read)
		const functionFragment = contract.interface.getFunction(method);
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		let result: any;
		if (
			functionFragment &&
			!functionFragment.constant &&
			functionFragment.stateMutability !== "view" &&
			functionFragment.stateMutability !== "pure"
		) {
			elizaLogger.debug(`Using staticCall for non-view method: ${method}`);
			result = await contractMethod.staticCall(...args);
		} else {
			elizaLogger.debug(`Using direct call for view/pure method: ${method}`);
			result = await contractMethod(...args);
		}
		elizaLogger.info("Contract read result", { result });

		const serializedResult = serializeResult(result);
		elizaLogger.debug("Contract read successful", { method, serializedResult });
		return serializedResult as T;
	} catch (error: unknown) {
		elizaLogger.error("Error reading contract", {
			method,
			contractAddress,
			error:
				error instanceof Error
					? { message: error.message, stack: error.stack }
					: String(error),
		});
		throw new Error(
			`Failed to read contract method ${method}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
};

/**
 * Invokes a method on a smart contract (sends a transaction) using ethers.js.
 */
export const invokeContract = async ({
	runtime,
	networkId,
	contractAddress,
	abi,
	method,
	args = [],
	value,
}: {
	runtime: IAgentRuntime;
	networkId: string;
	contractAddress: string;
	abi: ethers.InterfaceAbi;
	method: string;
	args?: unknown[];
	value?: string | bigint; // Optional value for sending native currency (e.g., ETH, ROSE)
}): Promise<TransactionReceipt> => {
	elizaLogger.debug("Invoking contract using ethersHelper.invokeContract", {
		networkId,
		contractAddress,
		method,
		args,
		value,
	});
	const signer = await getSigner(runtime, networkId);
	const contract = new ethers.Contract(contractAddress, abi, signer);

	try {
		const contractMethod = contract[method] as ethers.ContractMethod<
			// biome-ignore lint/suspicious/noExplicitAny: Accessing contract method dynamically
			any[],
			ethers.ContractTransactionResponse
		>;
		if (!contractMethod) {
			throw new Error(`Method '${method}' not found on contract ABI.`);
		}

		// const txValue = value ? ethers.parseEther(value.toString()) : 0n; // Assuming value is in Ether unit
		// Use parseUnits with 18 decimals (standard for ROSE/ETH) for clarity
		const txValue = value ? ethers.parseUnits(value.toString(), 18) : 0n;
		elizaLogger.debug(
			`Sending transaction with value: ${txValue.toString()} wei`,
		);

		const txResponse: ethers.ContractTransactionResponse = await contractMethod(
			...args,
			{ value: txValue },
		);
		elizaLogger.info(`Transaction sent: ${txResponse.hash}`, {
			method,
			contractAddress,
		});

		elizaLogger.debug("Waiting for transaction receipt...");
		const receipt = await txResponse.wait(); // Wait for confirmation

		if (!receipt) {
			throw new Error("Transaction receipt was null after waiting.");
		}

		elizaLogger.info(`Transaction confirmed: ${receipt.hash}`, {
			blockNumber: receipt.blockNumber,
			status: receipt.status,
		});

		// Adapt ethers.TransactionReceipt to our simpler TransactionReceipt type
		const formattedReceipt: TransactionReceipt = {
			transactionHash: receipt.hash,
			status: receipt.status === 1, // 1 for success, 0 for failure
			blockNumber: receipt.blockNumber,
			// events: receipt.logs, // Optionally include raw logs/events if needed
		};

		return formattedReceipt;
	} catch (error: unknown) {
		elizaLogger.error("Error invoking contract", {
			method,
			contractAddress,
			error:
				error instanceof Error
					? { message: error.message, stack: error.stack }
					: String(error),
		});
		// Try to extract revert reason if available
		let reason = "Unknown reason";
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		if (error instanceof Error && (error as any).data) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			reason = (error as any).data;
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} else if (error instanceof Error && (error as any).reason) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			reason = (error as any).reason;
		}
		throw new Error(
			`Failed to invoke contract method ${method}: ${reason} (${error instanceof Error ? error.message : String(error)})`,
		);
	}
};
