import { beforeEach, describe, expect, it, vi } from "vitest";
import { OASIS_NETWORKS } from "../src/constants";
import {
	createContractHelper,
	getNetworkId,
	getUserAddressString,
} from "../src/helpers/contractUtils";

// Mock ethers
vi.mock("ethers", () => ({
	Contract: vi.fn().mockImplementation(() => ({
		functions: {
			mockMethod: vi.fn().mockResolvedValue(["mockResult"]),
		},
		mockMethod: vi.fn().mockResolvedValue(["mockResult"]),
	})),
	JsonRpcProvider: vi.fn().mockImplementation(() => ({
		getBalance: vi.fn().mockResolvedValue("1000000000000000000"),
	})),
	Wallet: vi.fn().mockImplementation(() => ({
		address: "0xmockaddress",
		connect: vi.fn().mockReturnThis(),
	})),
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
			secrets: {
				THORN_PRIVATE_KEY: "0x1234567890abcdef",
			},
		},
	},
	agentId: "test-agent-id",
};

describe("Contract Utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getNetworkId", () => {
		it("should return correct network ID for testnet", () => {
			const networkId = getNetworkId(mockRuntime as any);
			expect(networkId).toBe("oasis-sapphire-testnet");
		});

		it("should return correct network ID for mainnet", () => {
			const mainnetRuntime = {
				...mockRuntime,
				getSetting: vi.fn().mockReturnValue(OASIS_NETWORKS.MAINNET),
			};
			const networkId = getNetworkId(mainnetRuntime as any);
			expect(networkId).toBe("oasis-sapphire");
		});

		it("should default to testnet when no network setting is found", () => {
			const noNetworkRuntime = {
				...mockRuntime,
				getSetting: vi.fn().mockReturnValue(undefined),
			};
			const networkId = getNetworkId(noNetworkRuntime as any);
			expect(networkId).toBe("oasis-sapphire-testnet");
		});
	});

	describe("getUserAddressString", () => {
		it("should return the wallet address from private key", () => {
			const address = getUserAddressString(mockRuntime as any);
			expect(address).toBe("0xmockaddress");
		});

		it("should handle errors when private key is invalid", () => {
			const invalidKeyRuntime = {
				...mockRuntime,
				getSetting: vi.fn().mockReturnValue("invalid-key"),
			};

			expect(() =>
				getUserAddressString(invalidKeyRuntime as any),
			).not.toThrow();
			// In actual implementation, this might throw or return a fallback
		});
	});

	describe("createContractHelper", () => {
		it("should create a contract helper instance", () => {
			const helper = createContractHelper(mockRuntime as any);
			expect(helper).toBeDefined();
			expect(typeof helper.readContract).toBe("function");
			expect(typeof helper.invokeContract).toBe("function");
		});

		it("should be able to read from a contract", async () => {
			const helper = createContractHelper(mockRuntime as any);

			const result = await helper.readContract({
				networkId: "oasis-sapphire-testnet",
				contractAddress: "0xcontractaddress",
				method: "mockMethod",
				args: [],
				abi: [
					{ name: "mockMethod", inputs: [], outputs: [{ type: "string" }] },
				],
			});

			expect(result).toBe("mockResult");
		});

		it("should be able to invoke a contract", async () => {
			const helper = createContractHelper(mockRuntime as any);

			const result = await helper.invokeContract({
				networkId: "oasis-sapphire-testnet",
				contractAddress: "0xcontractaddress",
				method: "mockMethod",
				args: [],
				abi: [
					{ name: "mockMethod", inputs: [], outputs: [{ type: "string" }] },
				],
				value: "0",
			});

			expect(result).toHaveProperty("hash");
		});
	});
});
