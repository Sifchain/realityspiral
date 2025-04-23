import { elizaLogger } from "@elizaos/core";
import type { ContractHelper } from "@realityspiral/plugin-coinbase";
import { ABIS } from "../constants";

/**
 * Service for querying token data
 */
export class TokenQueries {
	private contractHelper: ContractHelper;
	private networkId: string;

	constructor(contractHelper: ContractHelper, networkId: string) {
		this.contractHelper = contractHelper;
		this.networkId = networkId;
	}

	/**
	 * Get token decimals
	 */
	async getTokenDecimals(tokenAddress: string): Promise<number> {
		try {
			const decimals = await this.contractHelper.invokeContract({
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
			const symbol = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "symbol",
				args: [],
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
			const name = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "name",
				args: [],
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
			const balance = await this.contractHelper.invokeContract({
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
			const allowance = await this.contractHelper.invokeContract({
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
