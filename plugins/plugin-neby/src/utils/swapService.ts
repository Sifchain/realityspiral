import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ethers } from "ethers";
import { ABIS, POOL_FEES } from "../constants";
import type { SwapResult, TransactionReceipt } from "../types";
import { invokeContract, readContract } from "./ethersHelper";

/**
 * Service for handling token swaps on Neby DEX
 */
export class SwapService {
	private runtime: IAgentRuntime;
	private networkId: string;
	private swapRouterAddress: string;
	private quoterAddress: string;

	constructor(
		runtime: IAgentRuntime,
		networkId: string,
		swapRouterAddress: string,
		quoterAddress: string,
	) {
		this.runtime = runtime;
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
			elizaLogger.info("Getting swap quote using quoteExactInput", {
				fromToken,
				toToken,
				amount,
			});

			// Create exact input single params
			const params = {
				tokenIn: fromToken,
				tokenOut: toToken,
				amountIn: amount,
				fee: POOL_FEES.MEDIUM, // Default to medium fee tier
				sqrtPriceLimitX96: 0,
			};

			elizaLogger.info("Quote parameters", {
				params,
			});

			// Use readContract from ethersHelper
			const result = await readContract<string>({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: this.quoterAddress,
				method: "quoteExactInputSingle",
				args: [params],
				abi: ABIS.QUOTER,
			});

			elizaLogger.info("Quote result", {
				result,
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

			// Use invokeContract from ethersHelper
			const result = await invokeContract({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "approve",
				args: [spenderAddress, amount],
				abi: ABIS.ERC20,
			});

			return result; // ethersHelper.invokeContract returns TransactionReceipt
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

			// Set a deadline for the transaction (current time + 20 minutes)
			const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

			// Create exact input single params
			const params = {
				tokenIn: fromToken,
				tokenOut: toToken,
				fee: POOL_FEES.MEDIUM,
				recipient: recipient,
				deadline: deadline,
				amountIn: amount,
				amountOutMinimum: minAmountOut,
				sqrtPriceLimitX96: 0, // No price limit
			};

			elizaLogger.info("Swap parameters", {
				params,
				deadline: new Date(deadline * 1000).toISOString(),
			});

			// Use invokeContract from ethersHelper
			const invokeResult = await invokeContract({
				runtime: this.runtime,
				networkId: this.networkId,
				contractAddress: this.swapRouterAddress,
				method: "exactInputSingle",
				args: [params],
				abi: ABIS.SWAP_ROUTER,
			});

			elizaLogger.info("Swap transaction submitted", {
				transactionHash: invokeResult.transactionHash,
				blockNumber: invokeResult.blockNumber,
			});

			// TODO: How to get amountOut? The invokeContract helper currently only returns
			// TransactionReceipt (hash, status, block). The actual return value of the
			// 'exactInputSingle' method (amountOut) is not captured.
			// This needs adjustment in invokeContract or a separate read call after tx confirmation.
			// For now, returning a placeholder.
			const amountOutPlaceholder = "0"; // Placeholder
			elizaLogger.warn(
				"Swap executed, but amountOut not retrieved from invokeContract result.",
			);

			// Parse and return the result
			return {
				fromToken,
				toToken,
				amountIn: amount,
				amountOut: amountOutPlaceholder,
				transactionHash: invokeResult.transactionHash,
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
