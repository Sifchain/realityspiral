import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { ABIS, POOL_FEES, SAPPHIRE_MAINNET } from "../constants";
import { getProvider } from "../utils/ethersHelper"; // Use our new provider helper
import { getChecksummedAddress, getDeadline, sortTokens } from "../utils/utils";
import { invokeContractDirectly } from "./testUtils"; // Helper for contract calls

// Test parameters - MAINNET
const TEST_NETWORK = "mainnet";
const POSITION_MANAGER_ADDRESS = getChecksummedAddress(
	SAPPHIRE_MAINNET.CONTRACTS.NFT_POSITION_MANAGER,
);
const TOKEN_A_ADDRESS = getChecksummedAddress(SAPPHIRE_MAINNET.TOKENS.USDC); // USDC
const TOKEN_B_ADDRESS = getChecksummedAddress(SAPPHIRE_MAINNET.TOKENS.wROSE); // wROSE
const TEST_WALLET_ADDRESS = "0xD952175d6A20187d7A5803DcC9741472F640A9b8"; // Example address from manual log

// --- IMPORTANT ---
// Ensure the wallet associated with TESTNET_PRIVATE_KEY in your .env
// holds Mainnet ROSE (for gas), Mainnet USDC, and Mainnet wROSE.
// Adjust amounts below based on actual balances and desired test size.
const APPROVE_AMOUNT_USDC = ethers.parseUnits("1", 6); // Approve 1 USDC (6 decimals)
const APPROVE_AMOUNT_WROSE = ethers.parseUnits("100", 18); // Approve 100 wROSE (18 decimals)
const MINT_AMOUNT_USDC = ethers.parseUnits("0.1", 6); // Mint 0.1 USDC
const MINT_AMOUNT_WROSE = ethers.parseUnits("10", 18); // Mint 10 wROSE (adjust based on pool price)
// --- End Important ---

describe("NFT Position Manager Mainnet Operations (via invokeContractDirectly)", () => {
	// Assert preconditions
	expect(POSITION_MANAGER_ADDRESS).toBeDefined();
	expect(ABIS.NFT_POSITION_MANAGER).toBeDefined();
	expect(ABIS.ERC20).toBeDefined();
	expect(TOKEN_A_ADDRESS).toBeDefined();
	expect(TOKEN_B_ADDRESS).toBeDefined();

	// Test case for approve USDC
	it("should approve USDC spending for Position Manager", async () => {
		const args = [POSITION_MANAGER_ADDRESS, APPROVE_AMOUNT_USDC];
		try {
			const result = await invokeContractDirectly({
				contractAddress: TOKEN_A_ADDRESS,
				abi: ABIS.ERC20,
				method: "approve",
				args: args,
				isWriteOperation: true,
				network: TEST_NETWORK,
			});
			expect(result).toBeDefined();
			// biome-ignore lint/suspicious/noExplicitAny: Receipt type varies
			expect((result as any).status).toEqual(1);
			console.log("[Test Result] USDC Approve successful:", result.hash);
		} catch (error) {
			console.error("[Test Error] Failed to approve USDC:", error);
			throw error;
		}
	}, 300000); // 300,000 ms = 5 minutes

	// Test case for approve wROSE
	it("should approve wROSE spending for Position Manager", async () => {
		const args = [POSITION_MANAGER_ADDRESS, APPROVE_AMOUNT_WROSE];
		try {
			const result = await invokeContractDirectly({
				contractAddress: TOKEN_B_ADDRESS,
				abi: ABIS.ERC20,
				method: "approve",
				args: args,
				isWriteOperation: true,
				network: TEST_NETWORK,
			});
			expect(result).toBeDefined();
			// biome-ignore lint/suspicious/noExplicitAny: Receipt type varies
			expect((result as any).status).toEqual(1);
			console.log("[Test Result] wROSE Approve successful:", result.hash);
		} catch (error) {
			console.error("[Test Error] Failed to approve wROSE:", error);
			throw error;
		}
	}, 300000); // 300,000 ms = 5 minutes

	// Test case for mint and event parsing
	it("should mint a new position and parse the Mint event", async () => {
		// Sort tokens
		const [token0, token1] = sortTokens(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS);
		const amount0Desired =
			token0 === TOKEN_A_ADDRESS ? MINT_AMOUNT_USDC : MINT_AMOUNT_WROSE;
		const amount1Desired =
			token1 === TOKEN_B_ADDRESS ? MINT_AMOUNT_WROSE : MINT_AMOUNT_USDC;

		// Minimal slippage for testing - amounts need to be precise or tx will fail
		const amount0Min = (amount0Desired * 999n) / 1000n; // 0.1% slippage
		const amount1Min = (amount1Desired * 999n) / 1000n; // 0.1% slippage

		const mintParams = {
			token0,
			token1,
			fee: POOL_FEES.MEDIUM, // 3000 bps
			// TODO: These ticks likely need adjusting based on current mainnet pool price
			// Use very wide ticks for testing or get current tick from pool
			tickLower: -887220, // Example: Wide range
			tickUpper: 887220, // Example: Wide range
			amount0Desired: amount0Desired.toString(),
			amount1Desired: amount1Desired.toString(),
			amount0Min: amount0Min.toString(),
			amount1Min: amount1Min.toString(),
			recipient: TEST_WALLET_ADDRESS, // Mint to the test wallet
			deadline: getDeadline(1800), // 30 min deadline
		};

		console.log("[Test] Mint Params:", mintParams);

		let mintTxHash: string | undefined;
		try {
			const result = await invokeContractDirectly({
				contractAddress: POSITION_MANAGER_ADDRESS,
				abi: ABIS.NFT_POSITION_MANAGER,
				method: "mint",
				args: [mintParams],
				isWriteOperation: true,
				network: TEST_NETWORK,
			});
			expect(result).toBeDefined();
			mintTxHash = result.hash;
			// biome-ignore lint/suspicious/noExplicitAny: Receipt type varies
			expect((result as any).status).toEqual(1);
			console.log("[Test Result] Mint transaction successful:", mintTxHash);
		} catch (error) {
			console.error("[Test Error] Failed to execute mint transaction:", error);
			throw error;
		}

		// --- Event Parsing ---
		if (!mintTxHash) throw new Error("Mint transaction hash not found");

		try {
			console.log(`[Test] Fetching receipt for tx: ${mintTxHash}`);
			const provider = getProvider(
				TEST_NETWORK === "mainnet" ? "23294" : "23295",
			);
			const receipt = await provider.getTransactionReceipt(mintTxHash);
			expect(receipt).toBeDefined();
			if (!receipt) throw new Error("Failed to fetch transaction receipt");

			console.log(`[Test] Receipt block number: ${receipt.blockNumber}`);
			const contractInterface = new ethers.Interface(ABIS.NFT_POSITION_MANAGER);
			let mintEventFound = false;

			for (const log of receipt.logs) {
				try {
					const parsedLog = contractInterface.parseLog(log);
					// The event might be IncreaseLiquidity if adding to existing range/position
					// Or Transfer if minting a new NFT
					if (
						parsedLog &&
						(parsedLog.name === "IncreaseLiquidity" ||
							parsedLog.name === "Transfer")
					) {
						mintEventFound = true;
						console.log(
							`[Test] Found ${parsedLog.name} Event:`,
							parsedLog.args.toString(),
						);

						// Basic assertions based on event type
						if (parsedLog.name === "IncreaseLiquidity") {
							expect(parsedLog.args.tokenId).toBeDefined();
							expect(parsedLog.args.liquidity).toBeDefined();
							expect(
								BigInt(parsedLog.args.liquidity.toString()),
							).toBeGreaterThan(0n);
							expect(parsedLog.args.amount0).toBeDefined();
							expect(parsedLog.args.amount1).toBeDefined();
						} else if (parsedLog.name === "Transfer") {
							// For Transfer event, we mainly care that an NFT was transferred
							expect(parsedLog.args.tokenId).toBeDefined();
							expect(parsedLog.args.to).toBe(TEST_WALLET_ADDRESS);
						}
						break; // Found the event we needed
					}
				} catch (_parseError) {
					// Ignore logs that don't match the ABI
				}
			}

			expect(mintEventFound).toBe(true); // Assert that we found the expected event
		} catch (error) {
			console.error(
				"[Test Error] Failed to fetch receipt or parse logs:",
				error,
			);
			throw error;
		}
	}, 600000); // 600,000 ms = 10 minutes for approve + mint + fetch
});
