import "dotenv/config"; // Load .env file
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpyInstance } from "vitest";

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

// Import only what we need from our own codebase
import { ABI } from "../src/constants";
import {
	invokeContractAction,
	readContractAction,
	tokenContractPlugin,
} from "../src/plugins/tokenContract";
import { ContractHelper } from "../src/helpers/contractHelper";

// Only mock fs which doesn't have hoisting issues
vi.mock("node:fs", () => ({
	default: {
		existsSync: vi.fn().mockReturnValue(true),
		writeFileSync: vi.fn(),
		readFileSync: vi
			.fn()
			.mockReturnValue(JSON.stringify({ settings: { secrets: {} } })),
	},
}));

// Mock runtime with process.env support
const mockRuntime = {
	getSetting: vi.fn((key: string) => {
		if (key === "COINBASE_API_KEY") return process.env.COINBASE_API_KEY;
		if (key === "COINBASE_PRIVATE_KEY") return process.env.COINBASE_PRIVATE_KEY;
		if (key === "SOME_OTHER_SETTING") return "some-value";
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

// Simple message mock
const mockMessage = {
	id: "00000000-0000-0000-0000-000000000000",
	userId: "00000000-0000-0000-0000-000000000000",
	agentId: "00000000-0000-0000-0000-000000000000",
	roomId: "00000000-0000-0000-0000-000000000000",
	content: { text: "test message" },
	createdAt: new Date().getTime(),
};

// Empty state mock
const mockState = {};

describe("Token Contract Plugin Tests", () => {
	// Define test mocks in beforeEach so they're not at top level
	let isReadContractContent: SpyInstance;
	let isContractInvocationContent: SpyInstance;
	let mockGenerateObject: SpyInstance;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock these directly instead of using vi.mock
		isReadContractContent = vi.fn().mockReturnValue(true);
		isContractInvocationContent = vi.fn().mockReturnValue(true);
		mockGenerateObject = vi.fn();

		// Override the imported functions with our mocks
		(ContractHelper.prototype as any).readContract = vi.fn();
		(ContractHelper.prototype as any).invokeContract = vi.fn();

		// Mock the type validation functions
		vi.doMock("../src/types", () => ({
			isTokenContractContent: vi.fn().mockReturnValue(true),
			isContractInvocationContent,
			isReadContractContent,
			isWebhookContent: vi.fn().mockReturnValue(true),
			TokenContractSchema: { safeParse: vi.fn() },
			ContractInvocationSchema: { safeParse: vi.fn() },
			ReadContractSchema: { safeParse: vi.fn() },
			WebhookSchema: { safeParse: vi.fn() },
		}));

		// Reset runtime settings
		mockRuntime.getSetting.mockClear();
		mockRuntime.getSetting.mockImplementation((key: string) => {
			if (key === "COINBASE_API_KEY") return process.env.COINBASE_API_KEY;
			if (key === "COINBASE_PRIVATE_KEY")
				return process.env.COINBASE_PRIVATE_KEY;
			if (key === "SOME_OTHER_SETTING") return "some-value";
			return undefined;
		});
	});

	// Test the plugin properties directly without relying on anything being mocked
	describe("tokenContractPlugin", () => {
		it("should have correct plugin properties", () => {
			expect(tokenContractPlugin.name).toBe("tokenContract");
			expect(tokenContractPlugin.actions).toBeDefined();

			if (tokenContractPlugin.actions) {
				expect(Array.isArray(tokenContractPlugin.actions)).toBe(true);
				expect(tokenContractPlugin.actions).toHaveLength(3);

				const actionNames = tokenContractPlugin.actions.map(
					(action) => action.name,
				);
				expect(actionNames).toContain("DEPLOY_TOKEN_CONTRACT");
				expect(actionNames).toContain("INVOKE_CONTRACT");
				expect(actionNames).toContain("READ_CONTRACT");
			}
		});
	});

	describe("readContractAction", () => {
		it("should validate correctly", async () => {
			// Just a simple validation test that doesn't rely on mocks
			const result = await readContractAction.validate(
				mockRuntime as any,
				mockMessage as any,
			);
			expect(result).toBe(true);
		});

		it("should handle errors during contract read (e.g., invalid input)", async () => {
			// Override the validation mock for this test
			isReadContractContent.mockReturnValue(false);

			const mockCallback = vi.fn();

			// Mock the generateObject call result
			mockGenerateObject.mockResolvedValueOnce({
				object: {
					networkId: "base-sepolia",
				},
			});

			// Patch the generateObject into the module internally
			(globalThis as any).generateObject = mockGenerateObject;

			await readContractAction.handler(
				mockRuntime as any,
				mockMessage as any,
				mockState as any,
				{},
				mockCallback,
			);

			// Verify callback was called with error response
			expect(mockCallback).toHaveBeenCalledWith(
				{
					text: "Failed to read contract: Cannot read properties of undefined (reading 'name')",
				},
				[],
			);
		});

		// Additional tests can follow the same pattern
	});

	// Rest of tests follow similar patterns
});
