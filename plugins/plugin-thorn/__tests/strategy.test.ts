import "dotenv/config"; // Load .env file
import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Define the ElizaRuntime type inline
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
import { OASIS_NETWORKS } from "../src/constants";
import { createContractHelper } from "../src/helpers/contractUtils";
import {
	executeStrategyAction,
	setupStrategyAction,
	strategyProvider,
	thornStrategyPlugin,
} from "../src/plugins/strategy";

// Mock fs
vi.mock("node:fs", () => ({
	default: {
		existsSync: vi.fn().mockReturnValue(true),
		promises: {
			readFile: vi.fn().mockResolvedValue(
				JSON.stringify([
					{
						id: "strategy1",
						name: "Arbitrage Strategy",
						targetToken: "USDC",
						sourceTokens: ["USDT", "DAI"],
						totalBudget: "1000",
						maxSlippage: 0.5,
						triggerThreshold: 0.005,
						privacyLevel: "high",
						isActive: true,
						createdAt: 1622548800000,
						lastExecuted: 1622552400000,
						executionCount: 3,
						totalProfit: "12.5",
					},
				]),
			),
			writeFile: vi.fn().mockResolvedValue(undefined),
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

// Mock message with UUIDs
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
				token0: "0xUSDC",
				token1: "0xUSDT",
				reserve0: "1000000",
				reserve1: "1000000",
				fee: "0.05",
				privacyLevel: "high",
			},
		]),
		invokeContract: vi.fn().mockResolvedValue({
			hash: "0xabcdef1234567890",
			success: true,
		}),
	}),
	getNetworkId: vi.fn().mockReturnValue("oasis-sapphire-testnet"),
	getUserAddressString: vi.fn().mockReturnValue("0xuser1234"),
}));

// Mock global generateObject
const mockGenerateObject = vi.fn();
global.generateObject = mockGenerateObject;

describe("Thorn Strategy Plugin Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerateObject.mockResolvedValue({
			object: {
				name: "Arbitrage Strategy",
				targetToken: "USDC",
				sourceTokens: ["USDT", "DAI"],
				totalBudget: "1000",
				maxSlippage: 0.5,
				triggerThreshold: 0.005,
				privacyLevel: "high",
				isActive: true,
			},
		});
	});

	describe("strategyProvider", () => {
		it("should retrieve strategies from file storage", async () => {
			const result = await strategyProvider.get(
				mockRuntime as any,
				mockMessage,
			);

			expect(result).toHaveProperty("strategies");
			expect(result.strategies).toHaveLength(1);
			expect(result.strategies[0]).toHaveProperty("name", "Arbitrage Strategy");
			expect(result.strategies[0]).toHaveProperty("targetToken", "USDC");
		});

		it("should handle errors and return empty array", async () => {
			// Mock fs.promises.readFile to throw an error
			(fs.promises.readFile as any).mockRejectedValueOnce(
				new Error("Test error"),
			);

			const result = await strategyProvider.get(
				mockRuntime as any,
				mockMessage,
			);

			expect(result).toHaveProperty("strategies");
			expect(result.strategies).toEqual([]);
		});
	});

	describe("createStrategyAction", () => {
		it("should validate correctly when required settings are present", async () => {
			const result = await setupStrategyAction.validate(
				mockRuntime as any,
				mockMessage,
			);
			expect(result).toBe(true);
		});

		it("should fail validation when required settings are missing", async () => {
			// Mock getSetting to return undefined for required settings
			(mockRuntime.getSetting as any).mockImplementation(() => undefined);

			const result = await setupStrategyAction.validate(
				mockRuntime as any,
				mockMessage,
			);
			expect(result).toBe(false);
		});

		it("should create a strategy successfully", async () => {
			const mockCallback = vi.fn();

			await setupStrategyAction.handler(
				mockRuntime as any,
				mockMessage,
				mockState as any,
				{},
				mockCallback,
			);

			// Check if callback was called with success message
			expect(mockCallback).toHaveBeenCalled();
			const callbackArg = mockCallback.mock.calls[0][0];
			expect(callbackArg).toHaveProperty("text");
			expect(callbackArg.text).toContain("Strategy created successfully");
		});

		it("should handle invalid strategy parameters", async () => {
			const mockCallback = vi.fn();

			// Mock generateObject to return invalid parameters
			mockGenerateObject.mockResolvedValueOnce({
				object: {
					// Missing required fields
					name: "Invalid Strategy",
					// Missing targetToken and other required fields
				},
			});

			await setupStrategyAction.handler(
				mockRuntime as any,
				mockMessage,
				mockState as any,
				{},
				mockCallback,
			);

			// Check if callback was called with error message
			expect(mockCallback).toHaveBeenCalled();
			const callbackArg = mockCallback.mock.calls[0][0];
			expect(callbackArg).toHaveProperty("text");
			expect(callbackArg.text).toContain("Invalid strategy");
		});
	});

	describe("executeStrategyAction", () => {
		it("should validate correctly", async () => {
			const result = await executeStrategyAction.validate(
				mockRuntime as any,
				mockMessage,
			);
			expect(result).toBe(true);
		});

		it("should execute a strategy successfully", async () => {
			const mockCallback = vi.fn();

			await executeStrategyAction.handler(
				mockRuntime as any,
				mockMessage,
				mockState as any,
				{},
				mockCallback,
			);

			// Check if callback was called with success message
			expect(mockCallback).toHaveBeenCalled();
			const callbackArg = mockCallback.mock.calls[0][0];
			expect(callbackArg).toHaveProperty("text");
		});
	});

	describe("thornStrategyPlugin", () => {
		it("should have correct plugin properties", () => {
			expect(thornStrategyPlugin.name).toBe("thornStrategy");
			expect(thornStrategyPlugin.actions).toBeDefined();

			if (thornStrategyPlugin.actions) {
				expect(Array.isArray(thornStrategyPlugin.actions)).toBe(true);
				expect(thornStrategyPlugin.actions.length).toBeGreaterThan(0);

				const actionNames = thornStrategyPlugin.actions.map(
					(action) => action.name,
				);
				expect(actionNames).toContain("CREATE_STRATEGY");
				expect(actionNames).toContain("EXECUTE_STRATEGY");
			}
		});
	});
});
