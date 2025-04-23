import { elizaLogger } from "@elizaos/core";
import type { ContractHelper } from "@realityspiral/plugin-coinbase";
import { ethers } from "ethers";
import { ABIS, POOL_FEES } from "../constants";
import type { SwapResult, TransactionReceipt } from "../types";

/**
 * Service for handling token swaps on Neby DEX
 */
export class SwapService {
	private contractHelper: ContractHelper;
	private networkId: string;
	private swapRouterAddress: string;
	private quoterAddress: string;

	constructor(
		contractHelper: ContractHelper,
		networkId: string,
		swapRouterAddress: string,
		quoterAddress: string,
	) {
		this.contractHelper = contractHelper;
		this.networkId = networkId;
		this.swapRouterAddress = swapRouterAddress;
		this.quoterAddress = quoterAddress;
	}

	/**
	 * Get quote for a token swap
	 */
	async getSwapQuote(
		fromToken: string,
		toToken: string,
		amount: string,
	): Promise<string> {
		try {
			elizaLogger.info("Getting swap quote", { fromToken, toToken, amount });

			// Use the quoter contract to get the expected output amount
			const result = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: this.quoterAddress,
				method: "quoteExactInputSingle",
				args: [
					fromToken,
					toToken,
					POOL_FEES.MEDIUM, // Default to medium fee tier
					amount,
					0, // No price limit
				],
				abi: ABIS.QUOTER,
			});

			return result;
		} catch (error) {
			elizaLogger.error("Failed to get swap quote", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw new Error(
				`Failed to get swap quote: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Approve token spending for swap
	 */
	async approveTokenSpending(
		tokenAddress: string,
		spenderAddress: string,
		amount: string,
	): Promise<TransactionReceipt> {
		try {
			elizaLogger.info("Approving token spending", {
				tokenContract: tokenAddress,
				spender: spenderAddress,
				amount,
			});

			const result = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "approve",
				args: [spenderAddress, amount],
				abi: ABIS.ERC20,
			});

			return result;
		} catch (error) {
			elizaLogger.error("Failed to approve token spending", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw new Error(
				`Failed to approve token spending: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Execute a token swap transaction
	 */
	async executeSwap(
		fromToken: string,
		toToken: string,
		amount: string,
		minAmountOut: string,
		recipient: string,
	): Promise<SwapResult> {
		try {
			elizaLogger.info("Executing swap on Neby DEX", {
				fromToken,
				toToken,
				amount,
				minAmountOut,
				recipient,
			});

			// Create exact input single params
			const params = {
				tokenIn: fromToken,
				tokenOut: toToken,
				fee: POOL_FEES.MEDIUM,
				recipient: recipient,
				amountIn: amount,
				amountOutMinimum: minAmountOut,
				sqrtPriceLimitX96: 0, // No price limit
			};

			// Execute the swap
			const result = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: this.swapRouterAddress,
				method: "exactInputSingle",
				args: [params],
				abi: ABIS.SWAP_ROUTER,
				value: "0", // Set value if swapping from native token
			});

			// Parse and return the result
			return {
				fromToken,
				toToken,
				amountIn: amount,
				amountOut: result.toString(),
				transactionHash: result.transactionHash,
				timestamp: Date.now(),
			};
		} catch (error) {
			elizaLogger.error("Failed to execute swap", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw new Error(
				`Failed to execute swap: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}
