import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { ABIS, SAPPHIRE_TESTNET } from "../constants";
import { getChecksummedAddress } from "../utils/utils"; // Import the new helper
import { invokeContractDirectly } from "./testUtils"; // Helper for contract calls

// Test parameters
const TEST_NETWORK = "testnet";
const USDC_ADDRESS_RAW = SAPPHIRE_TESTNET.TOKENS.USDC;
const SPENDER_ADDRESS_RAW = SAPPHIRE_TESTNET.CONTRACTS.SWAP_ROUTER_02;
const TEST_AMOUNT = ethers.parseUnits("1", 6); // Assume Testnet USDC also has 6 decimals

// Use the new helper function
const usdcChecksummed = getChecksummedAddress(USDC_ADDRESS_RAW);
const spenderChecksummed = getChecksummedAddress(SPENDER_ADDRESS_RAW);

describe("ERC20 Write Operations (via invokeContractDirectly)", () => {
	// Assert preconditions
	expect(usdcChecksummed).toBeDefined();
	// expect(usdcChecksummed).not.toEqual(USDC_ADDRESS_RAW); // Removed: Checksumming might not change address for non-EIP55 formats
	expect(spenderChecksummed).toBeDefined();
	expect(ABIS.ERC20).toBeDefined();

	// Test case for approve
	it("should attempt to call approve on USDC token", async () => {
		const args = [spenderChecksummed, TEST_AMOUNT];
		try {
			// We expect this call to *initiate* successfully if the ABI/params are correct.
			// The underlying transaction might fail later on-chain due to lack of funds/gas,
			// but this test verifies the call setup via invokeContractDirectly.
			const result = await invokeContractDirectly({
				contractAddress: usdcChecksummed,
				abi: ABIS.ERC20,
				method: "approve",
				args: args,
				isWriteOperation: true, // Indicating a potential state change
				network: TEST_NETWORK,
			});
			// Check if the helper returned *something* (e.g., transaction hash, receipt placeholder)
			expect(result).toBeDefined();
			console.log(
				`[Test Result] approve(${spenderChecksummed}, ${TEST_AMOUNT}) call initiated. Result:`,
				JSON.stringify(result),
			);
		} catch (error: any) {
			// We don't necessarily expect an error here if invokeContractDirectly is just submitting,
			// but catch it just in case the helper throws during submission setup.
			console.error(
				"[Test Error] Failed during approve call initiation:",
				error.shortMessage || error.message || error,
			);
			throw error; // Re-throw to fail the test if the call setup itself fails
		}
	}, 60000); // 60 second timeout
});
