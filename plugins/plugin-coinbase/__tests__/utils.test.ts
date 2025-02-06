import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWalletDetails } from "../src/utils";

vi.mock("@coinbase/coinbase-sdk");

// Mock the runtime
const mockRuntime = {
	getSetting: vi
		.fn()
		.mockReturnValueOnce("test-seed") // COINBASE_GENERATED_WALLET_HEX_SEED
		.mockReturnValueOnce("test-wallet-id"), // COINBASE_GENERATED_WALLET_ID
	getProvider: vi.fn().mockReturnValue({ apiKey: "test-api-key" }),
	character: {
		name: "test-character",
	},
};

// Mock Wallet class
const mockWallet = {
	getDefaultAddress: vi.fn().mockResolvedValue("0x123"),
	getNetworkId: vi.fn().mockReturnValue("eth-mainnet"),
	listBalances: vi.fn().mockResolvedValue([["ETH", { toString: () => "1.0" }]]),
	getTransactions: vi.fn().mockResolvedValue([]),
	export: vi.fn().mockReturnValue({
		seed: "test-seed",
		walletId: "test-wallet-id",
	}),
};

describe("Utils", () => {
	describe("getWalletDetails", () => {
		beforeEach(() => {
			vi.clearAllMocks();
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			(Coinbase as any).networks = {
				EthereumMainnet: "eth-mainnet",
			};
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			(Wallet as any).import = vi.fn().mockResolvedValue(mockWallet);
		});

		it("should fetch wallet details successfully", async () => {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const result = await getWalletDetails(mockRuntime as any);

			expect(result).toEqual({
				balances: [{ asset: "ETH", amount: "1.0" }],
				transactions: [],
			});

			expect(Wallet.import).toHaveBeenCalledWith({
				seed: "test-seed",
				walletId: "test-wallet-id",
			});
		});

		it("should handle errors when fetching wallet details", async () => {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			(Wallet as any).import = vi
				.fn()
				.mockRejectedValue(new Error("Unable to retrieve wallet details."));

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			await expect(getWalletDetails(mockRuntime as any)).rejects.toThrow(
				"Unable to retrieve wallet details.",
			);
		});
	});
});
