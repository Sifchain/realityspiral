import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
	ABIS,
	POOL_FEES,
	SAPPHIRE_MAINNET,
	UNISWAP_V3_POOL_ABI,
} from "../constants";
import { getChecksummedAddress } from "../utils/utils"; // Import the new helper
import { invokeContractDirectly } from "./testUtils"; // Our helper

// Test parameters
const TEST_NETWORK = "mainnet";
const QUOTER_ADDRESS = SAPPHIRE_MAINNET.CONTRACTS.QUOTER;
const TOKEN_IN_ADDRESS_RAW = SAPPHIRE_MAINNET.TOKENS.WETH; // Input: WETH
const TOKEN_OUT_ADDRESS_RAW = SAPPHIRE_MAINNET.TOKENS.wROSE; // Output: wROSE
const TEST_AMOUNT_IN = ethers.parseUnits("0.01", 18).toString(); // Amount of WETH (18 decimals)
const TEST_FEE = POOL_FEES.MEDIUM; // Use 0.3% fee tier

// Basic check for the test helper setup
describe("invokeContractDirectly Helper", () => {
	it("should be importable", () => {
		expect(invokeContractDirectly).toBeDefined();
	});
});

describe("Quoter & Pool Read Operations (via invokeContractDirectly)", () => {
	// Test case for Quoter.quoteExactInput
	it("should call quoteExactInput on Quoter for WETH -> wROSE", async () => {
		// Assert preconditions
		expect(QUOTER_ADDRESS).toBeDefined();
		expect(TOKEN_IN_ADDRESS_RAW).toBeDefined();
		expect(TOKEN_OUT_ADDRESS_RAW).toBeDefined();
		expect(ABIS.QUOTER).toBeDefined();

		// Use the new helper for checksumming
		const tokenInChecksummed = getChecksummedAddress(TOKEN_IN_ADDRESS_RAW);
		const tokenOutChecksummed = getChecksummedAddress(TOKEN_OUT_ADDRESS_RAW);
		const quoterChecksummed = getChecksummedAddress(QUOTER_ADDRESS);

		// Encode the path for quoteExactInput: tokenIn, fee, tokenOut
		const path = ethers.solidityPacked(
			["address", "uint24", "address"],
			[tokenInChecksummed, TEST_FEE, tokenOutChecksummed],
		);

		// Define the arguments for the contract call
		const args = [path, TEST_AMOUNT_IN];

		try {
			const result = await invokeContractDirectly({
				contractAddress: quoterChecksummed, // Use checksummed address
				abi: ABIS.QUOTER, // ABI includes quoteExactInput
				method: "quoteExactInput", // Use the multi-hop function
				args: args,
				isWriteOperation: false, // This is a read operation
				network: TEST_NETWORK,
			});

			// Basic validation of the result
			expect(result).toBeDefined();
			const quoteAmount = BigInt(result); // Result should be amountOut (uint256)
			console.log(
				`[Test - quoteExactInput] Received mainnet quote: ${ethers.formatUnits(quoteAmount, 18)} wROSE for 0.01 WETH`,
			); // wROSE has 18 decimals
			expect(quoteAmount).toBeGreaterThan(0n); // Expect some amount out
		} catch (error) {
			console.error(
				"[Test Error] Failed to get mainnet swap quote using quoteExactInput:",
				error,
			);
			// Re-throw the error to fail the test explicitly
			throw error;
		}
		// Set a longer timeout if mainnet is slower or for first-time connection
	}, 90000); // 90 second timeout

	// Test case for Pool.liquidity
	it("should call liquidity() on the wROSE/WETH 3000bps pool", async () => {
		const poolAddress = "0xEaFB04B5d4fB753c32DBb2eC32B3bF7CdC7f5144";
		expect(poolAddress).toBeDefined();
		expect(ABIS.V3_CORE_FACTORY).toBeDefined(); // Need pool ABI

		const poolChecksummed = ethers.getAddress(poolAddress);

		try {
			const result = await invokeContractDirectly({
				contractAddress: poolChecksummed,
				abi: UNISWAP_V3_POOL_ABI, // Use the Pool ABI
				method: "liquidity",
				args: [], // No arguments for liquidity()
				isWriteOperation: false,
				network: TEST_NETWORK,
			});

			expect(result).toBeDefined();
			const liquidityAmount = BigInt(result);
			console.log(
				`[Test] Liquidity for wROSE/WETH 3000bps pool (${poolAddress}): ${liquidityAmount.toString()}`,
			);

			// Optional: Assert if liquidity is zero
			// expect(liquidityAmount).toBe(0n);
		} catch (error) {
			console.error("[Test Error] Failed to get pool liquidity:", error);
			throw error;
		}
	}, 60000); // 60 second timeout for this check

	// Test case for Pool.slot0
	it("should call slot0() on the wROSE/WETH 3000bps pool", async () => {
		const poolAddress = "0xEaFB04B5d4fB753c32DBb2eC32B3bF7CdC7f5144";
		expect(poolAddress).toBeDefined();
		expect(UNISWAP_V3_POOL_ABI).toBeDefined();

		const poolChecksummed = ethers.getAddress(poolAddress);

		try {
			const result = await invokeContractDirectly({
				contractAddress: poolChecksummed,
				abi: UNISWAP_V3_POOL_ABI,
				method: "slot0",
				args: [], // No arguments for slot0()
				isWriteOperation: false,
				network: TEST_NETWORK,
			});

			expect(result).toBeDefined();
			// Result structure: [sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked]
			const [sqrtPriceX96, tick] = result as [bigint, bigint]; // Extract first two elements
			console.log(
				`[Test] slot0 for pool ${poolAddress}: sqrtPriceX96=${sqrtPriceX96.toString()}, tick=${tick.toString()}`,
			);

			// Assert that sqrtPriceX96 is non-zero
			expect(sqrtPriceX96).toBeGreaterThan(0n);
		} catch (error) {
			console.error("[Test Error] Failed to get pool slot0:", error);
			throw error;
		}
	}, 60000); // 60 second timeout

	// Test case for Pool.slot0 on USDC/wROSE pool
	it("should call slot0() on the USDC/wROSE 3000bps pool", async () => {
		const poolAddressRaw = "0xDa6b7B88f5c659B08DF37e6daf043d52B985E8ff"; // Corrected USDC/wROSE 0.3% fee pool address from manual testing log
		expect(poolAddressRaw).toBeDefined();
		expect(UNISWAP_V3_POOL_ABI).toBeDefined();

		const poolChecksummed = getChecksummedAddress(poolAddressRaw); // Use helper

		try {
			const result = await invokeContractDirectly({
				contractAddress: poolChecksummed,
				abi: UNISWAP_V3_POOL_ABI,
				method: "slot0",
				args: [], // No arguments for slot0()
				isWriteOperation: false,
				network: TEST_NETWORK, // Should be 'mainnet'
			});

			expect(result).toBeDefined();
			const [sqrtPriceX96, tick] = result as [bigint, bigint];
			console.log(
				`[Test] slot0 for USDC/wROSE pool ${poolAddressRaw}: sqrtPriceX96=${sqrtPriceX96.toString()}, tick=${tick.toString()}`,
			);

			expect(sqrtPriceX96).toBeGreaterThan(0n);
		} catch (error) {
			console.error("[Test Error] Failed to get USDC/wROSE pool slot0:", error);
			throw error;
		}
	}, 60000); // 60 second timeout

	// --- Add more read operation tests here later ---
});
