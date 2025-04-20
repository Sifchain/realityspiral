import { Coinbase, readContract, Wallet } from "@coinbase/coinbase-sdk";
import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ABI } from "../constants";
import { initializeWallet } from "../utils";

// Helper function to serialize BigInt values (defined locally)
// biome-ignore lint/suspicious/noExplicitAny: Needed for generic serialization
const serializeBigInt = (value: any): any => {
	if (typeof value === "bigint") {
		return value.toString();
	}
	if (Array.isArray(value)) {
		return value.map(serializeBigInt);
	}
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value).map(([k, v]) => [k, serializeBigInt(v)]),
		);
	}
	return value;
};

/**
 * A helper class to manage contract interactions via Coinbase SDK
 */
export class ContractHelper {
	private runtime: IAgentRuntime;

	constructor(runtime: IAgentRuntime) {
		this.runtime = runtime;
		this.configureCoinbase(); // Configure SDK on instantiation
	}

	private configureCoinbase() {
		const apiKeyName =
			this.runtime.getSetting("COINBASE_API_KEY") ??
			process.env.COINBASE_API_KEY;
		const privateKey =
			this.runtime.getSetting("COINBASE_PRIVATE_KEY") ??
			process.env.COINBASE_PRIVATE_KEY;

		if (!apiKeyName || !privateKey) {
			elizaLogger.error(
				"ContractHelper Error: Coinbase API Key or Private Key not configured.",
			);
			throw new Error("Coinbase API Key or Private Key not configured.");
		}

		Coinbase.configure({
			apiKeyName: apiKeyName,
			privateKey: privateKey,
		});
		elizaLogger.debug("Coinbase SDK configured within ContractHelper.");
	}

	/**
	 * Read data from a smart contract
	 * @param params Parameters for contract reading (must include networkId, contractAddress, method, args, optionally abi)
	 * @returns The serialized contract response
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Needed for flexibility
	async readContract(params: any): Promise<any> {
		try {
			// Ensure configuration is applied (redundant if constructor always runs configure, but safe)
			this.configureCoinbase();
			elizaLogger.debug(
				"ContractHelper: Reading contract with params:",
				params,
			);
			const readParams = {
				...params,
				abi: params.abi || ABI, // Use provided ABI or default
			};
			const result = await readContract(readParams);
			const serializedResult = serializeBigInt(result); // Use local helper
			elizaLogger.debug(
				"ContractHelper: Read result (serialized):",
				serializedResult,
			);
			return serializedResult;
		} catch (error) {
			elizaLogger.error("ContractHelper: Error reading contract:", error);
			throw error;
		}
	}

	/**
	 * Invoke a method on a smart contract
	 * @param params Parameters for contract invocation (must include networkId, contractAddress, method, args, optionally abi, amount, assetId)
	 * @returns The contract invocation result
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Needed for flexibility
	async invokeContract(params: any): Promise<any> {
		try {
			// Ensure configuration is applied
			this.configureCoinbase();
			elizaLogger.debug(
				"ContractHelper: Invoking contract with params:",
				params,
			);
			const { wallet } = await initializeWallet(this.runtime, params.networkId);

			const invocationOptions = {
				contractAddress: params.contractAddress,
				method: params.method,
				abi: params.abi || ABI, // Use provided ABI or default
				args: {
					...(params.args || {}), // Ensure args is an object
					...(params.amount !== undefined && { amount: params.amount }),
				},
				networkId: params.networkId,
				...(params.assetId && { assetId: params.assetId }),
			};

			elizaLogger.info(
				"ContractHelper: Final invocation options:",
				invocationOptions,
			);

			const invocation = await wallet.invokeContract(invocationOptions);
			await invocation.wait(); // Wait for transaction mining
			elizaLogger.debug("ContractHelper: Invocation successful:", invocation);
			// You might want to return more structured data here
			return {
				status: invocation.getStatus(),
				transactionLink: invocation.getTransactionLink() || "",
				invocation: invocation, // Or specific properties
			};
		} catch (error) {
			elizaLogger.error("ContractHelper: Error invoking contract:", error);
			throw error;
		}
	}
} 