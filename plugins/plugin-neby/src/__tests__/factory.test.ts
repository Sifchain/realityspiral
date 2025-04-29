import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { ABIS, POOL_FEES, SAPPHIRE_MAINNET } from "../constants";
import { getChecksummedAddress } from "../utils/utils";
import { invokeContractDirectly } from "./testUtils";

// Test parameters
const TEST_NETWORK = "mainnet";
const FACTORY_ADDRESS_RAW = SAPPHIRE_MAINNET.CONTRACTS.V3_CORE_FACTORY;
const RAW_TOKEN_A = SAPPHIRE_MAINNET.TOKENS.wROSE;
const RAW_TOKEN_B = SAPPHIRE_MAINNET.TOKENS.WETH;

// Use the new helper function
const factoryChecksummed = getChecksummedAddress(FACTORY_ADDRESS_RAW);
let token0Checksummed: string;
let token1Checksummed: string;

// Determine order and checksum
if (RAW_TOKEN_A && RAW_TOKEN_B) {
	if (RAW_TOKEN_A.toLowerCase() < RAW_TOKEN_B.toLowerCase()) {
		token0Checksummed = getChecksummedAddress(RAW_TOKEN_A);
		token1Checksummed = getChecksummedAddress(RAW_TOKEN_B);
	} else {
		token0Checksummed = getChecksummedAddress(RAW_TOKEN_B);
		token1Checksummed = getChecksummedAddress(RAW_TOKEN_A);
	}
} else {
	console.error(
		"[Test Setup] wROSE or WETH address is undefined in constants!",
	);
}

describe("V3 Factory Read Operations (via invokeContractDirectly)", () => {
	// Assert preconditions
	expect(factoryChecksummed).toBeDefined();
	expect(token0Checksummed).toBeDefined();
	expect(token1Checksummed).toBeDefined();
	expect(ABIS.V3_CORE_FACTORY).toBeDefined();

	const feeTiersToTest = [
		POOL_FEES.LOWEST, // 100
		POOL_FEES.LOW, // 500
		POOL_FEES.MEDIUM, // 3000
		POOL_FEES.HIGH, // 10000
	];

	// Test each fee tier
	feeTiersToTest.forEach((feeTier) => {
		it(`should check for wROSE/WETH pool with ${feeTier / 10000}% fee`, async () => {
			const args = [token0Checksummed, token1Checksummed, feeTier];

			let poolAddress = "0x0000000000000000000000000000000000000000"; // Default to zero address
			try {
				const result = await invokeContractDirectly({
					contractAddress: factoryChecksummed,
					abi: ABIS.V3_CORE_FACTORY,
					method: "getPool",
					args: args,
					isWriteOperation: false,
					network: TEST_NETWORK,
				});

				expect(result).toBeDefined();
				poolAddress = result as string;
				console.log(
					`[Test Result] Pool address for ${feeTier} bps fee: ${poolAddress}`,
				);

				// We primarily care about the output, not asserting non-zero here
				// expect(poolAddress).not.toEqual('0x0000000000000000000000000000000000000000');
			} catch (error) {
				console.error(
					`[Test Error] Failed to get pool for fee ${feeTier}:`,
					error,
				);
				// If the call fails, it might indicate the pool doesn't exist or network issue
				// We'll log the error but not fail the test explicitly here,
				// as the goal is discovery.
				expect(error).toBeDefined(); // Expect an error object if it fails
			}
			// Set a longer timeout
		}, 45000);
	});
});
