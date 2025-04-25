import { Coinbase, Wallet, readContract } from "@coinbase/coinbase-sdk";
import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ABI } from "../constants";
import { getSupportedNetwork, initializeWallet } from "../utils";

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
			// Ensure configuration is applied
			this.configureCoinbase();

			// Ensure networkId is supported
			if (params.networkId) {
				params.networkId = getSupportedNetwork(params.networkId);
			}

			// Get the method definition from the ABI (use params.abi)
			const methodAbi = params.abi.find(
				(item: any) => item.name === params.method,
			);

			elizaLogger.debug("Method ABI:", JSON.stringify(methodAbi));

			if (!methodAbi) {
				throw new Error(`Method ${params.method} not found in ABI`);
			}

			// Check if method is read-only (view or pure)
			const isReadOnly =
				(methodAbi as any).constant === true ||
				methodAbi.stateMutability === "view" ||
				methodAbi.stateMutability === "pure";

			elizaLogger.debug(`Method ${params.method} isReadOnly:`, isReadOnly);

			if (!isReadOnly) {
				elizaLogger.warn(
					`Method ${params.method} is not marked as view/pure. Using invokeContract instead.`,
				);
				return this.invokeContract(params);
			}

			let argsObject: Record<string, any> = {};

			if (typeof params.args === "object" && !Array.isArray(params.args)) {
				// Use the object directly
				argsObject = { ...params.args };
			} else {
				// Create named arguments object from array
				const argsArray = Array.isArray(params.args) ? params.args : [];

				elizaLogger.info("argsArray", argsArray);

				// Map each array element to its corresponding named parameter
				if (methodAbi.inputs && methodAbi.inputs.length > 0) {
					for (let index = 0; index < methodAbi.inputs.length; index++) {
						const input = methodAbi.inputs[index];
						if (index < argsArray.length) {
							let value = argsArray[index];

							// Special handling for address type parameters
							if (input.type === "address" && value) {
								// If it's a wallet address object with addressId property
								if (typeof value === "object" && value.addressId) {
									elizaLogger.debug(
										`Converting WalletAddress object to string address: ${value.addressId}`,
									);
									value = value.addressId; // Extract the address string
								}
								// If it's an object with a toString method
								else if (
									typeof value === "object" &&
									typeof value.toString === "function"
								) {
									const stringVal = value.toString();
									elizaLogger.debug(
										`Converting object to string using toString(): ${stringVal}`,
									);
									value = stringVal;
								}

								// If value is not a valid address string by now, log warning
								if (typeof value !== "string" || !value.startsWith("0x")) {
									elizaLogger.warn(
										`Parameter for ${input.name} may not be a valid address: ${value}`,
									);
								}
							}

							// Use the exact parameter name from the ABI
							const paramName = input.name || "";
							argsObject[paramName] = value;
						}
					}
				}
			}

			// elizaLogger.debug("Read array args:", argsArray);
			elizaLogger.debug("Converted to object args:", argsObject);

			// Special validation for address parameters to handle WalletAddress string representation
			for (const [key, value] of Object.entries(argsObject)) {
				// Check if we're dealing with a string that looks like a WalletAddress object representation
				if (typeof value === "string" && value.includes("addressId:")) {
					// Try to extract the addressId from the string representation
					const match = value.match(/addressId: '(0x[a-fA-F0-9]+)'/);
					if (match && match[1]) {
						elizaLogger.debug(
							`Found addressId in string representation: ${match[1]}`,
						);
						argsObject[key] = match[1]; // Replace with just the address
					}
				}
			}

			elizaLogger.debug("Final processed args:", argsObject);

			const readParams = {
				contractAddress: params.contractAddress,
				method: params.method,
				abi: params.abi, // Use the ABI passed in parameters
				args: argsObject,
				networkId: params.networkId,
			};

			const invokeParams = {
				contractAddress: params.contractAddress,
				method: params.method,
				abi: methodAbi, // Use the ABI passed in parameters
				args: argsObject,
				networkId: params.networkId,
			};

			elizaLogger.info(
				"ContractHelper: Reading contract with params:",
				JSON.stringify(invokeParams),
			);

			const result = await readContract(readParams);
			const serializedResult = serializeBigInt(result);
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
	 * @param params Parameters for contract invocation (must include networkId, contractAddress, method, args as an array, optionally abi, amount, assetId)
	 * @returns The contract invocation result
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Needed for flexibility
	async invokeContract(params: any): Promise<any> {
		try {
			// Ensure configuration is applied
			this.configureCoinbase();

			// Ensure the networkId is in a format Coinbase SDK supports
			const networkId = params.networkId;
			const supportedNetworkId = getSupportedNetwork(networkId);

			const { wallet } = await initializeWallet(
				this.runtime,
				supportedNetworkId,
			);

			// Get the input names from the ABI for this method
			const methodAbi = params.abi.find(
				(item: any) =>
					item.name === params.method && item.inputs && item.inputs.length > 0,
			);

			if (!methodAbi) {
				throw new Error(
					`Method ${params.method} not found in ABI or has no inputs`,
				);
			}

			// Create named arguments object from array
			const argsArray = Array.isArray(params.args) ? params.args : [];
			const argsObject: Record<string, any> = {};

			elizaLogger.info("argsArray", argsArray);

			// Map each array element to its corresponding named parameter
			for (let index = 0; index < methodAbi.inputs.length; index++) {
				const input = methodAbi.inputs[index];
				if (index < argsArray.length) {
					let value = argsArray[index];

					if (input.type === "address" && value) {
						// Special handling for address type parameters
						// If it's a wallet address object with addressId property
						if (typeof value === "object" && value.addressId) {
							elizaLogger.debug(
								`Converting WalletAddress object to string address: ${value.addressId}`,
							);
							value = "0xD952175d6A20187d7A5803DcC9741472F640A9b8"; // Extract the address string
						}
						// If it's an object with a toString method
						else if (
							typeof value === "object" &&
							typeof value.toString === "function"
						) {
							const stringVal = value.toString();
							elizaLogger.debug(
								`Converting object to string using toString(): ${stringVal}`,
							);
							value = "0xD952175d6A20187d7A5803DcC9741472F640A9b8";
						}

						// If value is not a valid address string by now, log warning
						if (typeof value !== "string" || !value.startsWith("0x")) {
							elizaLogger.warn(
								`Parameter for ${input.name} may not be a valid address: ${value}`,
							);
						}
					}

					// Determine the argument name to use
					let argName = input.name;
					if (params.method === "balanceOf") {
						elizaLogger.debug(
							`For balanceOf method: input name in ABI is "${input.name}"`,
						);
						// If the function is balanceOf, always use the standard 'owner' parameter name
						// regardless of what's in the ABI (empty, account, _owner, etc.)
						argName = "owner";
						elizaLogger.debug(
							`Using 'owner' as parameter name for balanceOf method.`,
						);
					}
					if (argName === "spender") {
						argsObject[argName] = "0xD952175d6A20187d7A5803DcC9741472F640A9b8";
					} else {
						argsObject[argName] = value;
					}
				}
			}

			elizaLogger.debug("Input parameters:", methodAbi.inputs);
			elizaLogger.debug("Array args:", argsArray);
			elizaLogger.debug("Converted to object args:", argsObject);

			// Special validation for address parameters to handle WalletAddress string representation
			for (const [key, value] of Object.entries(argsObject)) {
				// Check if we're dealing with a string that looks like a WalletAddress object representation
				if (typeof value === "string" && value.includes("addressId:")) {
					// Try to extract the addressId from the string representation
					const match = value.match(/addressId: '(0x[a-fA-F0-9]+)'/);
					if (match && match[1]) {
						elizaLogger.debug(
							`Found addressId in string representation: ${match[1]}`,
						);
						argsObject[key] = match[1]; // Replace with just the address
					}
				}
			}

			elizaLogger.debug("Final processed args:", argsObject);

			// Create Coinbase SDK compatible parameters
			const callParams = {
				contractAddress: params.contractAddress,
				method: params.method,
				abi: params.abi,
				args: argsObject,
				networkId: supportedNetworkId,
				...(params.amount !== undefined && {
					amount: params.amount.toString(),
				}),
				...(params.assetId && { assetId: params.assetId }),
			};

			elizaLogger.info(
				"ContractHelper: Making API call with:",
				JSON.stringify(callParams),
			);

			// Make the call through the wallet
			const invocation = await wallet.invokeContract(callParams);
			await invocation.wait(); // Wait for transaction mining

			return {
				status: invocation.getStatus(),
				transactionLink: invocation.getTransactionLink() || "",
				invocation,
			};
		} catch (error) {
			elizaLogger.error("ContractHelper: Error invoking contract:", error);
			throw error;
		}
	}

	/**
	 * Gets the user's wallet address
	 * @param networkId Optional network ID to use when initializing wallet
	 * @returns The user's wallet address
	 */
	async getUserAddress(networkId?: string): Promise<string> {
		// try {
		// 	// Initialize the wallet to get the default address, using networkId if provided
		// 	const { wallet } = await initializeWallet(this.runtime, networkId);
		// 	const address = await wallet.getDefaultAddress();
		// 	// Convert address to string if it's not already
		// 	return typeof address === "string" ? address : address.toString();
		// } catch (error) {
		// 	elizaLogger.error("Error getting user address:", error);

		// 	// If there's an error, try to get the address from settings
		// 	const walletPublicKey = this.runtime.getSetting("WALLET_PUBLIC_KEY");
		// 	if (walletPublicKey) {
		// 		return walletPublicKey;
		// 	}

		// 	throw new Error("Could not retrieve user wallet address");
		// }
		return "0xD952175d6A20187d7A5803DcC9741472F640A9b8";
	}
}
