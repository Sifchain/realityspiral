import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ABI } from "../src/constants";
import { readContractAction, invokeContractAction, tokenContractPlugin } from "../src/plugins/tokenContract";
import { ContractHelper } from "../src/utils";

// Mock modules
vi.mock("@coinbase/coinbase-sdk");
vi.mock("csv-writer", () => ({
  createArrayCsvWriter: vi.fn().mockReturnValue({
    writeRecords: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../src/utils", () => ({
  ContractHelper: vi.fn().mockImplementation(() => ({
    readContract: vi.fn().mockResolvedValue({ balance: "1000000" }),
    invokeContract: vi.fn().mockResolvedValue({
      status: "SUCCESS",
      transactionLink: "https://etherscan.io/tx/0x123",
      invocation: {
        getStatus: vi.fn().mockReturnValue("SUCCESS"),
        getTransactionLink: vi.fn().mockReturnValue("https://etherscan.io/tx/0x123"),
        wait: vi.fn().mockResolvedValue(undefined),
      }
    }),
    configureSDK: vi.fn(),
  })),
  initializeWallet: vi.fn().mockResolvedValue({
    wallet: {
      deployToken: vi.fn().mockResolvedValue({
        getContractAddress: vi.fn().mockReturnValue("0x123"),
        getTransaction: vi.fn().mockReturnValue({
          getTransactionLink: vi.fn().mockReturnValue("https://etherscan.io/tx/0x123"),
        }),
        wait: vi.fn().mockResolvedValue(undefined),
      }),
      deployNFT: vi.fn().mockResolvedValue({
        getContractAddress: vi.fn().mockReturnValue("0x123"),
        getTransaction: vi.fn().mockReturnValue({
          getTransactionLink: vi.fn().mockReturnValue("https://etherscan.io/tx/0x123"),
        }),
        wait: vi.fn().mockResolvedValue(undefined),
      }),
    },
    walletType: "short_term_trading",
  }),
}));

// Mock instrumentation
vi.mock("@realityspiral/plugin-instrumentation", () => ({
  composeContext: vi.fn().mockReturnValue({}),
  traceResult: vi.fn().mockImplementation((state, response) => response),
}));

// Mock elizaos/core
vi.mock("@elizaos/core", () => ({
  elizaLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
  generateObject: vi.fn().mockResolvedValue({
    object: {
      // For read contract
      contractAddress: "0x123",
      method: "balanceOf",
      args: { account: "0x456" },
      networkId: "eth",
      
      // For invoke contract
      amount: "100",
      assetId: "eth",
      
      // For deploy contract
      contractType: "erc20",
      name: "Test Token",
      symbol: "TEST",
      network: "eth",
      totalSupply: 1000000,
    },
  }),
  ModelClass: {
    SMALL: "small",
    LARGE: "large",
  },
}));

// Mock fs and path
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(JSON.stringify({ settings: { secrets: {} } })),
  },
}));

// Mock runtime
const mockRuntime = {
  getSetting: vi.fn().mockReturnValue("test-api-key"),
  character: {
    name: "test-character",
    settings: {
      secrets: {
        COINBASE_API_KEY: "test-api-key",
        COINBASE_PRIVATE_KEY: "test-private-key",
      },
    },
  },
};

// Mock message
const mockMessage = {
  id: "00000000-0000-0000-0000-000000000000",
  userId: "00000000-0000-0000-0000-000000000000",
  agentId: "00000000-0000-0000-0000-000000000000",
  roomId: "00000000-0000-0000-0000-000000000000",
  content: { text: "test message" },
  createdAt: new Date().getTime(),
};

// Mock state
const mockState = {};

describe("Token Contract Plugin Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tokenContractPlugin", () => {
    it("should have correct plugin properties", () => {
      expect(tokenContractPlugin.name).toBe("tokenContract");
      expect(tokenContractPlugin.actions).toBeDefined();
      expect(Array.isArray(tokenContractPlugin.actions)).toBe(true);
      expect(tokenContractPlugin.actions).toHaveLength(3);
      
      // Verify actions exist
      const actionNames = tokenContractPlugin.actions.map(action => action.name);
      expect(actionNames).toContain("DEPLOY_TOKEN_CONTRACT");
      expect(actionNames).toContain("INVOKE_CONTRACT");
      expect(actionNames).toContain("READ_CONTRACT");
    });
  });

  describe("readContractAction", () => {
    it("should validate correctly", async () => {
      const result = await readContractAction.validate(
        mockRuntime as any,
        mockMessage as any
      );
      expect(result).toBe(true);
    });

    it("should read contract data successfully", async () => {
      const mockCallback = vi.fn();

      await readContractAction.handler(
        mockRuntime as any,
        mockMessage as any,
        mockState as any,
        {},
        mockCallback
      );

      // Verify ContractHelper was instantiated and readContract was called
      expect(ContractHelper).toHaveBeenCalledWith(mockRuntime);
      
      // Get the instance of ContractHelper that was created
      const contractHelperInstance = (ContractHelper as any).mock.results[0].value;
      expect(contractHelperInstance.readContract).toHaveBeenCalledWith(
        "0x123",
        "balanceOf",
        { account: "0x456" },
        "eth",
        ABI
      );

      // Verify callback was called with success response
      expect(mockCallback).toHaveBeenCalledWith(
        {
          text: expect.stringContaining("Contract read successful"),
        },
        []
      );
    });

    it("should handle errors when reading contract", async () => {
      const mockCallback = vi.fn();
      
      // Force readContract to throw an error
      (ContractHelper as any).mockImplementationOnce(() => ({
        readContract: vi.fn().mockRejectedValue(new Error("Contract read failed")),
        configureSDK: vi.fn(),
      }));

      await readContractAction.handler(
        mockRuntime as any,
        mockMessage as any,
        mockState as any,
        {},
        mockCallback
      );

      // Verify callback was called with error response
      expect(mockCallback).toHaveBeenCalledWith(
        {
          text: expect.stringContaining("Failed to read contract"),
        },
        []
      );
    });
  });

  describe("invokeContractAction", () => {
    it("should validate correctly", async () => {
      const result = await invokeContractAction.validate(
        mockRuntime as any,
        mockMessage as any
      );
      expect(result).toBe(true);
    });

    it("should invoke contract method successfully", async () => {
      const mockCallback = vi.fn();

      await invokeContractAction.handler(
        mockRuntime as any,
        mockMessage as any,
        mockState as any,
        {},
        mockCallback
      );

      // Verify ContractHelper was instantiated and invokeContract was called
      expect(ContractHelper).toHaveBeenCalledWith(mockRuntime);
      
      // Get the instance of ContractHelper that was created
      const contractHelperInstance = (ContractHelper as any).mock.results[0].value;
      expect(contractHelperInstance.invokeContract).toHaveBeenCalledWith(
        "0x123",
        "balanceOf",
        { account: "0x456" },
        "eth",
        ABI,
        "100",
        "eth"
      );

      // Verify callback was called with success response
      expect(mockCallback).toHaveBeenCalledWith(
        {
          text: expect.stringContaining("Contract method invoked successfully"),
        },
        []
      );
    });

    it("should handle errors when invoking contract", async () => {
      const mockCallback = vi.fn();
      
      // Force invokeContract to throw an error
      (ContractHelper as any).mockImplementationOnce(() => ({
        invokeContract: vi.fn().mockRejectedValue(new Error("Contract invocation failed")),
        configureSDK: vi.fn(),
      }));

      await invokeContractAction.handler(
        mockRuntime as any,
        mockMessage as any,
        mockState as any,
        {},
        mockCallback
      );

      // Verify callback was called with error response
      expect(mockCallback).toHaveBeenCalledWith(
        {
          text: expect.stringContaining("Failed to invoke contract method"),
        },
        []
      );
    });
  });
}); 