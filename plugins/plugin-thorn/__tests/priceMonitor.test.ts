import "dotenv/config"; // Load .env file
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

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
import {
	monitorPriceStabilityAction,
	priceStabilityProvider,
	thornPriceMonitorPlugin,
} from "../src/plugins/priceMonitor";
import { createContractHelper } from "../src/helpers/contractUtils";

// Mock fs
vi.mock("node:fs", () => ({
	default: {
		existsSync: vi.fn().mockReturnValue(true),
		promises: {
			readFile: vi
				.fn()
				.mockResolvedValue(
					"Timestamp,Token,Price,Deviation,Is Stable\n" +
						"1622548800000,USDC,1.002,0.002,true\n" +
						"1622548800000,USDT,0.998,0.002,true\n" +
						"1622548800000,DAI,0.995,0.005,true\n" +
						"1622548800000,FRAX,0.97,0.03,false",
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
		readContract: vi.fn().mockResolvedValue([]),
	}),
	getNetworkId: vi.fn().mockReturnValue("oasis-sapphire-testnet"),
}));

// Mock global generateObject
const mockGenerateObject = vi.fn();
global.generateObject = mockGenerateObject;

describe("Thorn Price Monitor Plugin Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerateObject.mockResolvedValue({
			object: {
				tokens: ["USDC", "USDT", "DAI", "FRAX"],
				alertThreshold: 0.01,
				intervalMinutes: 30,
			},
		});
	});

	describe("priceStabilityProvider", () => {
		it("should retrieve price stability records from CSV", async () => {
			const result = await priceStabilityProvider.get(
				mockRuntime as any,
				mockMessage,
			);

			expect(result).toHaveProperty("priceRecords");
			expect(result.priceRecords).toHaveLength(4);

			// Check specific records
			const usdcRecord = result.priceRecords.find((r) => r.token === "USDC");
			expect(usdcRecord).toBeDefined();
			expect(usdcRecord).toHaveProperty("isStable", true);

			const fraxRecord = result.priceRecords.find((r) => r.token === "FRAX");
			expect(fraxRecord).toBeDefined();
			expect(fraxRecord).toHaveProperty("isStable", false);
			expect(fraxRecord).toHaveProperty("deviation", 0.03);
		});

		it("should handle errors and return empty arrays", async () => {
			// Mock fs.promises.readFile to throw an error
			(fs.promises.readFile as any).mockRejectedValueOnce(
				new Error("Test error"),
			);

			const result = await priceStabilityProvider.get(
				mockRuntime as any,
				mockMessage,
			);

			expect(result).toHaveProperty("priceRecords");
			expect(result.priceRecords).toEqual([]);
		});
	});

	describe("monitorPriceStabilityAction", () => {
		it("should validate correctly when required settings are present", async () => {
			const result = await monitorPriceStabilityAction.validate(
				mockRuntime as any,
				mockMessage,
			);
			expect(result).toBe(true);
		});

		it("should fail validation when required settings are missing", async () => {
			// Mock getSetting to return undefined for required settings
			(mockRuntime.getSetting as any).mockImplementation(() => undefined);

			const result = await monitorPriceStabilityAction.validate(
				mockRuntime as any,
				mockMessage,
			);
			expect(result).toBe(false);
		});

		it("should monitor prices successfully and detect unstable tokens", async () => {
			const mockCallback = vi.fn();

			await monitorPriceStabilityAction.handler(
				mockRuntime as any,
				mockMessage,
				mockState as any,
				{},
				mockCallback,
			);

			// Check if callback was called with appropriate message
			expect(mockCallback).toHaveBeenCalled();
			const callbackArg = mockCallback.mock.calls[0][0];
			expect(callbackArg).toHaveProperty("text");
		});

		it("should handle invalid monitor parameters", async () => {
			const mockCallback = vi.fn();

			// Mock generateObject to return invalid parameters
			mockGenerateObject.mockResolvedValueOnce({
				object: {
					// Missing required fields or invalid values
					tokens: [],
					alertThreshold: -1,
				},
			});

			await monitorPriceStabilityAction.handler(
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
			expect(callbackArg.text).toContain("Invalid price monitoring parameters");
		});
	});

	describe("thornPriceMonitorPlugin", () => {
		it("should have correct plugin properties", () => {
			expect(thornPriceMonitorPlugin.name).toBe("thornPriceMonitor");
			expect(thornPriceMonitorPlugin.actions).toBeDefined();

			if (thornPriceMonitorPlugin.actions) {
				expect(Array.isArray(thornPriceMonitorPlugin.actions)).toBe(true);
				expect(thornPriceMonitorPlugin.actions.length).toBeGreaterThan(0);

				const actionNames = thornPriceMonitorPlugin.actions.map(
					(action) => action.name,
				);
				expect(actionNames).toContain("MONITOR_PRICE_STABILITY");
			}
		});
	});
}); 