/// <reference types="node" />

import { ethers } from "ethers";
import { SAPPHIRE_MAINNET, SAPPHIRE_TESTNET } from "../constants";

// Load environment variables
// Ensure your test runner (e.g., Vitest with dotenv) loads these
const TESTNET_PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;
// const TESTNET_RPC_URL = process.env.TESTNET_RPC_URL; // Removed - Use constant
// const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL; // Removed - Use constant

/**
 * Helper function to invoke contracts directly on a network for testing.
 * WARNING: Write operations WILL send real transactions and require gas.
 */
async function invokeContractDirectly({
	contractAddress,
	abi,
	method,
	args = [],
	isWriteOperation = false, // Determines if a signer and transaction are needed
	value = "0", // Optional value for sending native currency
	network = "testnet", // Default to testnet
}: {
	contractAddress: string;
	abi: ethers.InterfaceAbi;
	method: string;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	args?: any[];
	isWriteOperation?: boolean;
	value?: string;
	network?: "testnet" | "mainnet";
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
}): Promise<any> {
	// Return type could be refined

	const networkConfig =
		network === "testnet" ? SAPPHIRE_TESTNET : SAPPHIRE_MAINNET;
	const rpcUrl = networkConfig.RPC_URL; // Directly use URL from constants

	if (!rpcUrl) {
		throw new Error(`RPC URL for ${network} is not defined in constants.`);
	}

	const provider = new ethers.JsonRpcProvider(rpcUrl);

	if (isWriteOperation) {
		// --- WRITE OPERATION ---
		if (!TESTNET_PRIVATE_KEY) {
			throw new Error(
				"TESTNET_PRIVATE_KEY environment variable is required for write operations in tests.",
			);
		}
		// if (network !== "testnet") {
		// 	// Safety guard: Only allow testnet writes for now
		// 	throw new Error(
		// 		"Write operations are only supported on testnet for safety.",
		// 	);
		// }

		const signer = new ethers.Wallet(TESTNET_PRIVATE_KEY, provider);
		const contract = new ethers.Contract(contractAddress, abi, signer);
		const connectedAddress = await signer.getAddress();

		console.log(
			`[Test Helper] Executing WRITE operation: ${method} on ${contractAddress}`,
		);
		console.log(`           Network: ${network} (${rpcUrl})`);
		console.log(`           Signer: ${connectedAddress}`);
		// Serialize BigInts in args just for logging
		const loggableArgs = args.map((arg) =>
			typeof arg === "bigint" ? arg.toString() : arg,
		);
		console.log(`           Args: ${JSON.stringify(loggableArgs)}`);
		console.log(`           Value: ${value}`);

		try {
			const txResponse: ethers.TransactionResponse = await contract[method](
				...args,
				{ value: ethers.parseUnits(value || "0", "ether") },
			); // Assume value is in Ether for simplicity, adjust if needed
			console.log(`[Test Helper] Transaction sent: ${txResponse.hash}`);
			console.log("[Test Helper] Waiting for confirmation...");
			const receipt = await txResponse.wait(); // Wait for transaction confirmation
			if (receipt === null) {
				throw new Error("Transaction confirmation failed, receipt is null.");
			}
			console.log(
				`[Test Helper] Transaction confirmed in block: ${receipt.blockNumber}`,
			);
			return receipt; // Return the transaction receipt
		} catch (error) {
			console.error(
				`[Test Helper] Error executing write operation ${method}:`,
				error,
			);
			throw error;
		}
	} else {
		// --- READ OPERATION ---
		const contract = new ethers.Contract(contractAddress, abi, provider);
		console.log(
			`[Test Helper] Executing READ operation: ${method} on ${contractAddress}`,
		);
		console.log(`           Network: ${network} (${rpcUrl})`);
		console.log(`           Args: ${JSON.stringify(args)}`);
		// Serialize BigInts in args just for logging
		const loggableReadArgs = args.map((arg) =>
			typeof arg === "bigint" ? arg.toString() : arg,
		);
		console.log(`           Args: ${JSON.stringify(loggableReadArgs)}`);
		try {
			// Check if the method ABI indicates it's non-view (nonpayable or payable)
			const methodAbi = contract.interface.getFunction(method);
			// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
			let result;
			if (
				methodAbi &&
				!methodAbi.constant &&
				!methodAbi.stateMutability?.includes("view")
			) {
				// Use staticCall for non-view methods intended as reads (like quotes)
				console.log(
					`[Test Helper] Using staticCall for non-view read method: ${method}`,
				);
				result = await contract[method].staticCall(...args);
			} else {
				// Use direct call for view methods
				result = await contract[method](...args);
			}
			// console.log(`[Test Helper] Read operation successful. Result:`, result); // Can be verbose
			return result;
		} catch (error) {
			console.error(
				`[Test Helper] Error executing read operation ${method}:`,
				error,
			);
			throw error;
		}
	}
}

export { invokeContractDirectly };
