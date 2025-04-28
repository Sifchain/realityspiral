import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ABIS } from "../constants";
import { readContract } from "./ethersHelper";

/**
 * Service for querying token data
 */
export class TokenQueries {
	private runtime: IAgentRuntime;
	private networkId: string;

	constructor(runtime: IAgentRuntime, networkId: string) {
		this.runtime = runtime;
		this.networkId = networkId;
	}

	/**
	 * Get token decimals
	 */
	async getTokenDecimals(tokenAddress: string): Promise<number> {
		try {
			const decimals = await readContract<string | number>({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "decimals",
				args: [],
				abi: ABIS.ERC20,
			});

			return Number(decimals);
		} catch (error) {
			elizaLogger.error("Failed to get token decimals", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return 18; // Default to 18 decimals if query fails
		}
	}

	/**
	 * Get token symbol
	 */
	async getTokenSymbol(tokenAddress: string): Promise<string> {
		try {
			const symbol = await readContract<string>({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "symbol",
				args: [],
				// Minimal ABI for symbol
				abi: [
					{
						constant: true,
						inputs: [],
						name: "symbol",
						outputs: [{ name: "", type: "string" }],
						type: "function",
					},
				],
			});

			return symbol;
		} catch (error) {
			elizaLogger.error("Failed to get token symbol", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return "UNKNOWN"; // Return unknown if query fails
		}
	}

	/**
	 * Get token name
	 */
	async getTokenName(tokenAddress: string): Promise<string> {
		try {
			const name = await readContract<string>({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "name",
				args: [],
				// Minimal ABI for name
				abi: [
					{
						constant: true,
						inputs: [],
						name: "name",
						outputs: [{ name: "", type: "string" }],
						type: "function",
					},
				],
			});

			return name;
		} catch (error) {
			elizaLogger.error("Failed to get token name", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return "Unknown Token"; // Return unknown if query fails
		}
	}

	/**
	 * Get token balance for an address
	 */
	async getTokenBalance(
		tokenAddress: string,
		accountAddress: string,
	): Promise<string> {
		try {
			const balance = await readContract<string>({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "balanceOf",
				args: [accountAddress],
				abi: ABIS.ERC20,
			});

			return balance.toString();
		} catch (error) {
			elizaLogger.error("Failed to get token balance", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return "0"; // Return 0 if query fails
		}
	}

	/**
	 * Get token allowance
	 */
	async getTokenAllowance(
		tokenAddress: string,
		ownerAddress: string,
		spenderAddress: string,
	): Promise<string> {
		try {
			const allowance = await readContract<string>({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "allowance",
				args: [ownerAddress, spenderAddress],
				abi: ABIS.ERC20,
			});

			return allowance.toString();
		} catch (error) {
			elizaLogger.error("Failed to get token allowance", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return "0"; // Return 0 if query fails
		}
	}
}
