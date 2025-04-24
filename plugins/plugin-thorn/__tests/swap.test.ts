import "dotenv/config"; // Load .env file
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpyInstance } from "vitest";
import fs from "node:fs";

// Define the ElizaRuntime type inline to avoid importing it
type ElizaRuntime = {
	getSetting: (key: string) => string | undefined;
	character: {
		name: string;
		settings: {
			secrets: Record<string, string>;
		};
	};
	agentId?: string;
};

// Import the modules to test
import {
	OASIS_NETWORKS,
	THORN_CONTRACTS,
	TOKEN_ADDRESSES,
} from "../src/constants";
import {
	executeSwapAction,
	swapProvider,
	thornSwapPlugin,
} from "../src/plugins/swap";
import { createContractHelper } from "../src/helpers/contractUtils";

// Mock fs
vi.mock("node:fs", () => ({
	default: {
		existsSync: vi.fn().mockReturnValue(true),
		promises: {
			readFile: vi
				.fn()
				.mockResolvedValue(
					"Timestamp,From Token,To Token,Sent Amount,Received Amount,Exchange Rate,Fee,Privacy Level,Transaction Hash\n" +
						"1622548800000,USDC,USDT,100,99.5,0.995,0.5,high,0x123456789abcdef",
				),
		},
		writeFileSync: vi.fn(),
	},
}));

// Mock CSV writer
vi.mock("csv-writer", () => ({
	createArrayCsvWriter: vi.fn().mockReturnValue({
		writeRecords: vi.fn().mockResolvedValue(undefined),
	}),
}));

// Mock runtime
const mockRuntime = {
	getSetting: vi.fn((key: string) => {
		if (key === "OASIS_NETWORK") return OASIS_NETWORKS.TESTNET;
		if (key === "THORN_API_URL") return "https://api.testnet.thorn.fi";
		if (key === "THORN_PRIVATE_KEY") return "0x1234567890abcdef";
		return undefined;
	}),
	character: {
		name: "test-character",
		settings: {
			secrets: {},
		},
	},
	agentId: "test-agent-id",
};

// Mock message
const mockMessage = {
	id: "00000000-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`,
	userId:
		"00000000-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`,
	agentId:
		"00000000-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`,
	roomId:
		"00000000-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`,
	content: { text: "test message" },
	createdAt: new Date().getTime(),
};

// Mock state
const mockState = {};

// Mock the contract helper
vi.mock("../src/helpers/contractUtils", () => ({
	createContractHelper: vi.fn().mockReturnValue({
		readContract: vi.fn().mockResolvedValue([
			{
				id: "pool1",
				token0: TOKEN_ADDRESSES.TESTNET.USDC,
				token1: TOKEN_ADDRESSES.TESTNET.USDT,
				reserve0: "1000000",
				reserve1: "1000000",
				fee: "0.05",
				privacyLevel: "high",
			},
		]),
		invokeContract: vi.fn().mockResolvedValue({
			hash: "0xabcdef1234567890",
			fromToken: "USDC",
			toToken: "USDT",
			sentAmount: "100",
			receivedAmount: "99.5",
			timestamp: Date.now(),
		}),
	}),
	getNetworkId: vi.fn().mockReturnValue("oasis-sapphire-testnet"),
	getUserAddressString: vi.fn().mockReturnValue("0xuser1234"),
}));

// Mock global generateObject
const mockGenerateObject = vi.fn();
global.generateObject = mockGenerateObject;

describe("Thorn Swap Plugin Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerateObject.mockResolvedValue({
			object: {
				fromToken: "USDC",
				toToken: "USDT",
				amount: "100",
				slippage: 0.5,
				privacyLevel: "high",
			},
		});
	});

	describe("swapProvider", () => {
		it("should retrieve swap history from CSV", async () => {
			const result = await swapProvider.get(mockRuntime as any, mockMessage);

			expect(result).toHaveProperty("swapHistory");
			expect(result).toHaveProperty("liquidityPools");
			expect(result.swapHistory).toHaveLength(1);
			expect(result.swapHistory[0]).toHaveProperty("fromToken", "USDC");
			expect(result.swapHistory[0]).toHaveProperty("toToken", "USDT");
		});

		it("should handle errors and return empty arrays", async () => {
			// Mock fs.promises.readFile to throw an error
			(fs.promises.readFile as any).mockRejectedValueOnce(
				new Error("Test error"),
			);

			const result = await swapProvider.get(mockRuntime as any, mockMessage);

			expect(result).toHaveProperty("swapHistory");
			expect(result).toHaveProperty("liquidityPools");
			expect(result.swapHistory).toEqual([]);
			expect(result.liquidityPools).toEqual([]);
		});
	});

	describe("executeSwapAction", () => {
		it("should validate correctly when required settings are present", async () => {
			const result = await executeSwapAction.validate(
				mockRuntime as any,
				mockMessage as any,
			);
			expect(result).toBe(true);
		});

		it("should fail validation when required settings are missing", async () => {
			// Mock getSetting to return undefined for required settings
			(mockRuntime.getSetting as any).mockImplementationOnce(() => undefined);

			const result = await executeSwapAction.validate(
				mockRuntime as any,
				mockMessage as any,
			);
			expect(result).toBe(false);
		});

		it("should execute swap successfully", async () => {
			const mockCallback = vi.fn();

			await executeSwapAction.handler(
				mockRuntime as any,
				mockMessage as any,
				mockState as any,
				{},
				mockCallback,
			);

			// Check if callback was called with success message
			expect(mockCallback).toHaveBeenCalled();
			const callbackArg = mockCallback.mock.calls[0][0];
			expect(callbackArg).toHaveProperty("text");
			expect(callbackArg.text).toContain("Swap executed successfully");
		});

		it("should handle invalid swap parameters", async () => {
			const mockCallback = vi.fn();

			// Mock generateObject to return invalid parameters
			mockGenerateObject.mockResolvedValueOnce({
				object: {
					// Missing required fields
					fromToken: "INVALID_TOKEN",
				},
			});

			await executeSwapAction.handler(
				mockRuntime as any,
				mockMessage as any,
				mockState as any,
				{},
				mockCallback,
			);

			// Check if callback was called with error message
			expect(mockCallback).toHaveBeenCalled();
			const callbackArg = mockCallback.mock.calls[0][0];
			expect(callbackArg).toHaveProperty("text");
			expect(callbackArg.text).toContain("Invalid swap parameters");
		});
	});

	describe("thornSwapPlugin", () => {
		it("should have correct plugin properties", () => {
			expect(thornSwapPlugin.name).toBe("thornSwap");
			expect(thornSwapPlugin.actions).toBeDefined();

			if (thornSwapPlugin.actions) {
				expect(Array.isArray(thornSwapPlugin.actions)).toBe(true);
				expect(thornSwapPlugin.actions.length).toBeGreaterThan(0);

				const actionNames = thornSwapPlugin.actions.map(
					(action) => action.name,
				);
				expect(actionNames).toContain("EXECUTE_SWAP");
			}
		});
	});
}); 