import type { IAgentRuntime, Memory, State } from "@elizaos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	BITPROTOCOL_CONTRACTS,
	BORROWER_OPERATIONS_ABI,
	ERC20_ABI,
	NETWORK_CONFIG,
	PRICE_FEED_ABI,
	ROUTER_ABI,
	TOKEN_ADDRESSES,
} from "../constants";
import {
	getOptimalSwapPathAction,
	monitorPriceStabilityAction,
	privateSwapAction,
	swapAction,
} from "../plugins/bitprotocol";
import type { PriceStabilityInfo, SwapPath, SwapResult } from "../types"; // Correct type import
import * as utils from "../utils"; // Import like this to mock specific functions

// Mock ContractHelper globally
const mockInvokeContract = vi.fn();
const mockReadContract = vi.fn();
const mockGetUserAddress = vi.fn();
vi.mock("@realityspiral/plugin-coinbase", () => ({
	ContractHelper: vi.fn().mockImplementation(() => ({
		invokeContract: mockInvokeContract,
		readContract: mockReadContract,
		getUserAddress: mockGetUserAddress,
	})),
}));

// Mock utility functions
const mockParseTokenAmount = vi.spyOn(utils, "parseTokenAmount");
const mockFormatTokenAmount = vi.spyOn(utils, "formatTokenAmount");

// Mock runtime
const mockGetSetting = vi.fn();
const mockRuntime: Partial<IAgentRuntime> = {
	getSetting: mockGetSetting,
};

// Common test variables
const mockMessage = {} as Memory;
const mockState = {} as State;
const mockCallback = vi.fn();

describe("BitProtocol Plugin Actions", () => {
	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks();

		// Default mock implementations
		mockGetSetting.mockImplementation((key: string) => {
			if (key === "BITPROTOCOL_RPC_URL") return "mock_rpc_url";
			if (key === "BITPROTOCOL_NETWORK_ID")
				return NETWORK_CONFIG.OASIS_SAPPHIRE.chainId.toString(); // Use constant
			if (key === "BITPROTOCOL_MAX_SLIPPAGE") return "0.005";
			if (key === "BITPROTOCOL_PRIVACY_ENABLED") return "true";
			return null;
		});
		mockGetUserAddress.mockResolvedValue("0xMockUserAddress");
		mockInvokeContract.mockResolvedValue({ transactionLink: "tx/0xMockHash" });
		mockReadContract.mockResolvedValue("0"); // Default read value
		mockParseTokenAmount.mockResolvedValue(BigInt("1000000000000000000")); // 1 token
		mockFormatTokenAmount.mockResolvedValue("1.0");
	});

	describe("swapAction", () => {
		const validOptions = {
			fromTokenSymbol: "ROSE",
			toTokenSymbol: "BitUSD",
			amountStr: "10",
		};

		it("should validate valid options successfully", async () => {
			await expect(swapAction.validate(validOptions as any)).resolves.toBe(
				true,
			);
		});

		it("should fail validation for invalid options", async () => {
			const invalidOptions = { fromTokenSymbol: "ROSE" };
			await expect(swapAction.validate(invalidOptions as any)).resolves.toBe(
				false,
			);
		});

		it("should perform a standard swap for non-native tokens", async () => {
			const options = {
				fromTokenSymbol: "BitUSD", // Non-native
				toTokenSymbol: "ROSE",
				amountStr: "50",
			};
			mockReadContract.mockResolvedValueOnce({
				// Mock getOptimalPath
				path: [TOKEN_ADDRESSES.BitUSD, TOKEN_ADDRESSES.ROSE],
				estimatedOutput: "49000000000000000000", // 49 ROSE
			});
			mockFormatTokenAmount.mockResolvedValueOnce("49.0"); // For result formatting

			const result = (await swapAction.handler(
				mockRuntime as IAgentRuntime,
				mockMessage,
				mockState,
				options,
				mockCallback,
			)) as SwapResult;

			// Check approve call
			expect(mockInvokeContract).toHaveBeenCalledWith(
				expect.objectContaining({
					contractAddress: TOKEN_ADDRESSES.BitUSD,
					method: "approve",
					args: [BITPROTOCOL_CONTRACTS.BorrowerOperations, expect.any(String)],
					abi: ERC20_ABI,
				}),
			);

			// Check swap call
			expect(mockInvokeContract).toHaveBeenCalledWith(
				expect.objectContaining({
					contractAddress: BITPROTOCOL_CONTRACTS.BitVault,
					method: "swap", // Standard swap
					args: expect.arrayContaining([
						TOKEN_ADDRESSES.BitUSD,
						TOKEN_ADDRESSES.ROSE,
						expect.any(String), // amountParsed
						expect.any(String), // minOutput
						expect.any(Number), // deadline
					]),
					abi: ROUTER_ABI,
				}),
			);
			expect(result.transactionHash).toBe("0xMockHash");
			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: expect.stringContaining("Swap initiated"),
				}),
			);
		});

		it("should skip approve and perform swap for native ROSE token", async () => {
			mockReadContract.mockResolvedValueOnce({
				// Mock getOptimalPath
				path: [TOKEN_ADDRESSES.ROSE, TOKEN_ADDRESSES.BitUSD],
				estimatedOutput: "9900000000000000000", // 9.9 BitUSD
			});
			mockFormatTokenAmount.mockResolvedValueOnce("9.9"); // For result formatting

			const result = (await swapAction.handler(
				mockRuntime as IAgentRuntime,
				mockMessage,
				mockState,
				validOptions, // ROSE -> BitUSD
				mockCallback,
			)) as SwapResult;

			// Should NOT call approve for native token
			expect(mockInvokeContract).not.toHaveBeenCalledWith(
				expect.objectContaining({ method: "approve" }),
			);

			// Check swap call
			expect(mockInvokeContract).toHaveBeenCalledWith(
				expect.objectContaining({
					contractAddress: BITPROTOCOL_CONTRACTS.BitVault,
					method: "swap",
					args: expect.arrayContaining([
						TOKEN_ADDRESSES.ROSE,
						TOKEN_ADDRESSES.BitUSD,
					]),
					abi: ROUTER_ABI,
				}),
			);
			expect(result.transactionHash).toBe("0xMockHash");
			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: expect.stringContaining("Swap initiated"),
				}),
			);
		});

		it("should handle errors during swap", async () => {
			mockInvokeContract.mockRejectedValueOnce(
				new Error("Swap execution failed"),
			);

			await expect(
				swapAction.handler(
					mockRuntime as IAgentRuntime,
					mockMessage,
					mockState,
					validOptions,
					mockCallback,
				),
			).rejects.toThrow("Swap execution failed");

			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: expect.stringContaining("Swap failed"),
				}),
			);
		});
	});

	describe("privateSwapAction", () => {
		const validOptions = {
			fromTokenSymbol: "ROSE",
			toTokenSymbol: "BitUSD",
			amountStr: "10",
			private: true, // Ensure this flag is included for validation if schema requires it
		};

		it("should validate valid options successfully", async () => {
			await expect(
				privateSwapAction.validate(validOptions as any),
			).resolves.toBe(true);
		});

		it("should fail validation for invalid options", async () => {
			const invalidOptions = { fromTokenSymbol: "ROSE" };
			await expect(
				privateSwapAction.validate(invalidOptions as any),
			).resolves.toBe(false);
		});

		it("should perform a private swap", async () => {
			const options = {
				fromTokenSymbol: "BitUSD", // Non-native
				toTokenSymbol: "ROSE",
				amountStr: "20",
			};
			mockInvokeContract.mockResolvedValueOnce({
				transactionLink: "tx/approvePrivate",
			}); // Approval
			mockInvokeContract.mockResolvedValueOnce({
				transactionLink: "tx/privateSwapHash",
			}); // Private swap

			const result = (await privateSwapAction.handler(
				mockRuntime as IAgentRuntime,
				mockMessage,
				mockState,
				options,
				mockCallback,
			)) as SwapResult;

			// Check confidential approve call
			expect(mockInvokeContract).toHaveBeenCalledWith(
				expect.objectContaining({
					contractAddress: TOKEN_ADDRESSES.BitUSD,
					method: "approve",
					args: [BITPROTOCOL_CONTRACTS.BitVault, expect.any(String)],
					abi: ERC20_ABI,
					confidential: true,
				}),
			);

			// Check privateSwap call
			expect(mockInvokeContract).toHaveBeenCalledWith(
				expect.objectContaining({
					contractAddress: BITPROTOCOL_CONTRACTS.BitVault,
					method: "privateSwap",
					args: expect.arrayContaining([
						TOKEN_ADDRESSES.BitUSD,
						TOKEN_ADDRESSES.ROSE,
						expect.any(String), // amountParsed
						expect.any(String), // minOutput
						expect.any(Number), // deadline
						expect.any(String), // encryptedData
					]),
					abi: ROUTER_ABI,
					confidential: true,
					gasLimit: expect.any(Number),
				}),
			);

			expect(result.transactionHash).toBe("privateSwapHash");
			expect(result.isConfidential).toBe(true);
			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: expect.stringContaining("Private swap initiated"),
				}),
			);
		});

		it("should handle errors during private swap", async () => {
			mockInvokeContract.mockRejectedValueOnce(
				new Error("Private swap failed"),
			);

			await expect(
				privateSwapAction.handler(
					mockRuntime as IAgentRuntime,
					mockMessage,
					mockState,
					validOptions,
					mockCallback,
				),
			).rejects.toThrow("Private swap failed");

			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: expect.stringContaining("Private swap failed"),
				}),
			);
		});

		it("should throw error if TEE is disabled in config", async () => {
			mockGetSetting.mockImplementation((key: string) => {
				if (key === "BITPROTOCOL_PRIVACY_ENABLED") return "false"; // Disable TEE
				return null;
			});

			await expect(
				privateSwapAction.handler(
					mockRuntime as IAgentRuntime,
					mockMessage,
					mockState,
					validOptions,
					mockCallback,
				),
			).rejects.toThrow("Privacy features are not available");
		});
	});

	describe("monitorPriceStabilityAction", () => {
		it("should validate successfully (no options)", async () => {
			await expect(
				monitorPriceStabilityAction.validate({} as any),
			).resolves.toBe(true);
		});

		it("should fetch and format price, determine stability", async () => {
			mockReadContract.mockResolvedValueOnce("1005000000000000000"); // Price slightly above 1.0 (1.005)
			mockFormatTokenAmount.mockResolvedValueOnce("1.005");

			const result = (await monitorPriceStabilityAction.handler(
				mockRuntime as IAgentRuntime,
				mockMessage,
				mockState,
				{},
				mockCallback,
			)) as PriceStabilityInfo;

			expect(mockReadContract).toHaveBeenCalledWith(
				expect.objectContaining({
					contractAddress: BITPROTOCOL_CONTRACTS.PriceFeed,
					method: "lastGoodPrice",
					abi: PRICE_FEED_ABI,
				}),
			);
			expect(mockFormatTokenAmount).toHaveBeenCalledWith(
				BigInt("1005000000000000000"),
				BITPROTOCOL_CONTRACTS.DebtToken,
				expect.any(Object), // ContractHelper instance
				NETWORK_CONFIG.OASIS_SAPPHIRE.chainId.toString(), // Use constant
			);

			expect(result.price).toBe("1.005");
			expect(result.isStable).toBe(true); // Within 0.99 - 1.01
			expect(result.timestamp).toBeCloseTo(Date.now(), -2); // Check timestamp is recent
			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: "BitProtocol price: 1.005 (Stable: Yes)",
				}),
			);
		});

		it("should determine instability if price is outside bounds", async () => {
			mockReadContract.mockResolvedValueOnce("980000000000000000"); // Price below 0.99 (0.98)
			mockFormatTokenAmount.mockResolvedValueOnce("0.98");

			const result = (await monitorPriceStabilityAction.handler(
				mockRuntime as IAgentRuntime,
				mockMessage,
				mockState,
				{},
				mockCallback,
			)) as PriceStabilityInfo;

			expect(result.price).toBe("0.98");
			expect(result.isStable).toBe(false);
			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: "BitProtocol price: 0.98 (Stable: No)",
				}),
			);
		});

		it("should handle errors during price check", async () => {
			mockReadContract.mockRejectedValueOnce(new Error("PriceFeed read error"));

			await expect(
				monitorPriceStabilityAction.handler(
					mockRuntime as IAgentRuntime,
					mockMessage,
					mockState,
					{},
					mockCallback,
				),
			).rejects.toThrow("PriceFeed read error");

			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: expect.stringContaining("Price check failed"),
				}),
			);
		});
	});

	describe("getOptimalSwapPathAction", () => {
		const validOptions = {
			fromTokenSymbol: "ROSE",
			toTokenSymbol: "BitUSD",
			amountStr: "100",
		};

		it("should validate valid options successfully", async () => {
			await expect(
				getOptimalSwapPathAction.validate(
					mockRuntime as IAgentRuntime,
					validOptions,
				),
			).resolves.toBe(true);
		});

		it("should fail validation for invalid options", async () => {
			const invalidOptions = { fromTokenSymbol: "ROSE" };
			await expect(
				getOptimalSwapPathAction.validate(
					mockRuntime as IAgentRuntime,
					invalidOptions,
				),
			).resolves.toBe(false);
		});

		it("should call contract and return optimal path and formatted output", async () => {
			const mockPathResult = {
				path: [
					TOKEN_ADDRESSES.ROSE,
					TOKEN_ADDRESSES.wstROSE,
					TOKEN_ADDRESSES.BitUSD,
				],
				estimatedOutput: "95000000000000000000", // 95 BitUSD
			};
			mockReadContract.mockResolvedValueOnce(mockPathResult);
			mockFormatTokenAmount.mockResolvedValueOnce("95.0");

			const result = (await getOptimalSwapPathAction.handler(
				mockRuntime as IAgentRuntime,
				mockMessage,
				mockState,
				validOptions,
				mockCallback,
			)) as SwapPath;

			expect(mockReadContract).toHaveBeenCalledWith(
				expect.objectContaining({
					contractAddress: BITPROTOCOL_CONTRACTS.MultiCollateralHintHelpers,
					method: "getOptimalPath",
					args: [
						TOKEN_ADDRESSES.ROSE,
						TOKEN_ADDRESSES.BitUSD,
						expect.any(String),
					],
					abi: ROUTER_ABI,
				}),
			);
			expect(mockFormatTokenAmount).toHaveBeenCalledWith(
				BigInt(mockPathResult.estimatedOutput),
				TOKEN_ADDRESSES.BitUSD,
				expect.any(Object),
				NETWORK_CONFIG.OASIS_SAPPHIRE.chainId.toString(), // Use constant
			);

			expect(result.path).toEqual(["ROSE", "wstROSE", "BitUSD"]);
			expect(result.estimatedOutput).toBe(mockPathResult.estimatedOutput);
			expect(result.formattedOutput).toBe("95.0");
			expect(result.inputAmount).toBe("100");
			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: expect.stringContaining(
						"Optimal path: 100 ROSE → ROSE → wstROSE → BitUSD with estimated output of 95.0 BitUSD",
					),
				}),
			);
		});

		it("should use fallback path logic if contract call fails", async () => {
			mockReadContract.mockRejectedValueOnce(
				new Error("Path calculation failed"),
			);
			mockFormatTokenAmount.mockResolvedValueOnce("95.0"); // For 95% estimate

			const result = (await getOptimalSwapPathAction.handler(
				mockRuntime as IAgentRuntime,
				mockMessage,
				mockState,
				validOptions, // ROSE -> BitUSD
				mockCallback,
			)) as SwapPath;

			expect(mockReadContract).toHaveBeenCalledTimes(1); // Ensure contract was called
			expect(result.path).toEqual(["ROSE", "BitUSD"]); // Fallback direct path
			expect(result.formattedOutput).toBe("95.0"); // Based on 95% fallback estimate
			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: expect.stringContaining(
						"Optimal path: 100 ROSE → ROSE → BitUSD with estimated output of 95.0 BitUSD",
					),
				}),
			);
		});

		it("should handle errors during path calculation (e.g., parsing error)", async () => {
			mockParseTokenAmount.mockRejectedValueOnce(new Error("Invalid amount"));

			await expect(
				getOptimalSwapPathAction.handler(
					mockRuntime as IAgentRuntime,
					mockMessage,
					mockState,
					validOptions,
					mockCallback,
				),
			).rejects.toThrow("Invalid amount");

			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: expect.stringContaining("Failed to calculate optimal path"),
				}),
			);
		});
	});
}); 
