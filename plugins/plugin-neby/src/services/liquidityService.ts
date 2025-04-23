import { elizaLogger } from "@elizaos/core";
import type { ContractHelper } from "@realityspiral/plugin-coinbase";
import { ethers } from "ethers";
import { ABIS, POOL_FEES } from "../constants";
import type { LiquidityResult, TransactionReceipt } from "../types";
import {
	calculateMinAmount,
	getDeadline,
	getMaxUint128,
	sortTokens,
} from "./utils";

/**
 * Service for handling liquidity operations on Neby DEX
 */
export class LiquidityService {
	private contractHelper: ContractHelper;
	private networkId: string;
	private positionManagerAddress: string;
	private factoryAddress: string;

	constructor(
		contractHelper: ContractHelper,
		networkId: string,
		positionManagerAddress: string,
		factoryAddress: string,
	) {
		this.contractHelper = contractHelper;
		this.networkId = networkId;
		this.positionManagerAddress = positionManagerAddress;
		this.factoryAddress = factoryAddress;
	}

	/**
	 * Approve token spending for liquidity operations
	 */
	async approveTokenSpending(
		tokenAddress: string,
		amount: string,
	): Promise<TransactionReceipt> {
		try {
			elizaLogger.info("Approving token spending for liquidity operation", {
				tokenContract: tokenAddress,
				spender: this.positionManagerAddress,
				amount,
			});

			const result = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: tokenAddress,
				method: "approve",
				args: [this.positionManagerAddress, amount],
				abi: ABIS.ERC20,
			});

			return result;
		} catch (error) {
			elizaLogger.error("Failed to approve token spending for liquidity", {
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
	 * Add liquidity to a pool
	 */
	async addLiquidity(
		tokenA: string,
		tokenB: string,
		amountA: string,
		amountB: string,
		slippage: number,
		recipient: string,
	): Promise<LiquidityResult> {
		try {
			elizaLogger.info("Adding liquidity to Neby pool", {
				tokenA,
				tokenB,
				amountA,
				amountB,
				slippage,
				recipient,
			});

			// Sort tokens (lower address first as per Uniswap V3 convention)
			const [token0, token1] = sortTokens(tokenA, tokenB);

			// Determine amounts based on token order
			const amount0Desired = tokenA === token0 ? amountA : amountB;
			const amount1Desired = tokenA === token0 ? amountB : amountA;

			// Calculate min amounts based on slippage
			const amount0Min = calculateMinAmount(amount0Desired, slippage);
			const amount1Min = calculateMinAmount(amount1Desired, slippage);

			// Calculate deadline (30 minutes from now)
			const deadline = getDeadline();

			// Create mint params
			const mintParams = {
				token0,
				token1,
				fee: POOL_FEES.MEDIUM,
				tickLower: -887220, // Default tick range for common price ranges
				tickUpper: 887220, // Adjust based on actual requirements
				amount0Desired,
				amount1Desired,
				amount0Min,
				amount1Min,
				recipient,
				deadline,
			};

			// Execute the position creation
			const result = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: this.positionManagerAddress,
				method: "mint",
				args: [mintParams],
				abi: ABIS.NFT_POSITION_MANAGER,
			});

			// Parse result - adapt to match LiquidityResult interface
			return {
				tokenA,
				tokenB,
				amountA: result.amount0 || "0",
				amountB: result.amount1 || "0",
				liquidity: result.liquidity.toString(),
				transactionHash: result.transactionHash,
				timestamp: Date.now(),
			};
		} catch (error) {
			elizaLogger.error("Failed to add liquidity", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw new Error(
				`Failed to add liquidity: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Remove liquidity from a pool
	 */
	async removeLiquidity(
		tokenA: string,
		tokenB: string,
		liquidity: string,
	): Promise<LiquidityResult> {
		try {
			// For the Neby implementation, we need to first get the token ID from the provided tokens
			// This is an implementation detail that may differ from the interface
			const tokenId = await this.getPositionIdForTokens(tokenA, tokenB);

			if (!tokenId) {
				throw new Error(`No position found for tokens ${tokenA} and ${tokenB}`);
			}

			elizaLogger.info("Removing liquidity from Neby pool", {
				tokenId,
				tokenA,
				tokenB,
				liquidity,
			});

			// Calculate deadline
			const deadline = getDeadline();

			// Create decrease liquidity params
			const decreaseLiquidityParams = {
				tokenId,
				liquidity,
				amount0Min: 0, // Setting to 0 - in production, calculate based on slippage
				amount1Min: 0,
				deadline,
			};

			// Execute the decrease liquidity transaction
			const _decreaseResult = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: this.positionManagerAddress,
				method: "decreaseLiquidity",
				args: [decreaseLiquidityParams],
				abi: ABIS.NFT_POSITION_MANAGER,
			});

			// Create collect params to withdraw tokens
			const collectParams = {
				tokenId,
				recipient: await this.contractHelper.getUserAddress(this.networkId),
				amount0Max: getMaxUint128(),
				amount1Max: getMaxUint128(),
			};

			// Execute the collect transaction
			const collectResult = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: this.positionManagerAddress,
				method: "collect",
				args: [collectParams],
				abi: ABIS.NFT_POSITION_MANAGER,
			});

			// Return the result - adapt to match LiquidityResult interface
			return {
				tokenA,
				tokenB,
				amountA: collectResult.amount0.toString(),
				amountB: collectResult.amount1.toString(),
				liquidity: "0", // Liquidity has been fully removed
				transactionHash: collectResult.transactionHash,
				timestamp: Date.now(),
			};
		} catch (error) {
			elizaLogger.error("Failed to remove liquidity", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw new Error(
				`Failed to remove liquidity: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get position ID for a given token pair (helper method)
	 * This is an implementation detail not exposed in the public interface
	 */
	private async getPositionIdForTokens(
		tokenA: string,
		tokenB: string,
	): Promise<string | null> {
		try {
			// Sort the tokens to match how they'd be stored in a position
			const [token0, token1] = sortTokens(tokenA, tokenB);
			elizaLogger.info("Finding position for token pair", { token0, token1 });

			// Get the user's address
			const userAddress = await this.contractHelper.getUserAddress(
				this.networkId,
			);
			elizaLogger.info("User address for position lookup", { userAddress });

			// First, get balance of position NFTs
			const balanceResult = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: this.positionManagerAddress,
				method: "balanceOf",
				args: [userAddress],
				abi: ABIS.NFT_POSITION_MANAGER,
			});

			const balance = Number(balanceResult);
			elizaLogger.info("User position balance", { balance });

			if (balance === 0) {
				elizaLogger.info("User has no positions");
				return null;
			}

			// For each position NFT, check if it matches our token pair
			// We need to use a different approach since Uniswap doesn't provide a method
			// to get all positions by owner directly

			// Get token IDs owned by the user - in a production environment with many positions,
			// you would want to use a proper indexer or data service
			const potentialPositionIds: string[] = [];

			// First approach: Check owned token IDs by querying token by index
			for (let i = 0; i < Math.min(balance, 100); i++) {
				try {
					const tokenIdResult = await this.contractHelper.invokeContract({
						networkId: this.networkId,
						contractAddress: this.positionManagerAddress,
						method: "tokenOfOwnerByIndex",
						args: [userAddress, i],
						abi: [
							{
								inputs: [
									{ internalType: "address", name: "owner", type: "address" },
									{ internalType: "uint256", name: "index", type: "uint256" },
								],
								name: "tokenOfOwnerByIndex",
								outputs: [
									{ internalType: "uint256", name: "", type: "uint256" },
								],
								stateMutability: "view",
								type: "function",
							},
						],
					});

					potentialPositionIds.push(tokenIdResult.toString());
				} catch (error) {
					elizaLogger.warn("Error getting token ID by index", {
						error: error instanceof Error ? error.message : String(error),
						index: i,
					});
					break;
				}
			}

			// If we couldn't get positions by index (contract might not support ERC721Enumerable)
			// we could fall back to checking events, but this is outside the scope of this implementation

			if (potentialPositionIds.length === 0) {
				elizaLogger.warn("No position IDs found for user");
				return null;
			}

			elizaLogger.info("Found potential position IDs", {
				count: potentialPositionIds.length,
			});

			// Check each position to see if it matches our token pair
			for (const tokenId of potentialPositionIds) {
				try {
					const positionInfo = await this.contractHelper.invokeContract({
						networkId: this.networkId,
						contractAddress: this.positionManagerAddress,
						method: "positions",
						args: [tokenId],
						abi: ABIS.NFT_POSITION_MANAGER,
					});

					// Check if this position uses our token pair
					const positionToken0 = positionInfo.token0.toLowerCase();
					const positionToken1 = positionInfo.token1.toLowerCase();

					if (
						positionToken0 === token0.toLowerCase() &&
						positionToken1 === token1.toLowerCase()
					) {
						elizaLogger.info("Found matching position", { tokenId });
						return tokenId;
					}
				} catch (error) {
					elizaLogger.warn("Error checking position details", {
						error: error instanceof Error ? error.message : String(error),
						tokenId,
					});
				}
			}

			elizaLogger.info("No matching positions found for token pair");
			return null;
		} catch (error) {
			elizaLogger.error("Failed to get position ID for tokens", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			return null;
		}
	}

	/**
	 * Get pool liquidity info
	 */
	async getPoolLiquidity(
		tokenA: string,
		tokenB: string,
		fee: number = POOL_FEES.MEDIUM,
	): Promise<string> {
		try {
			elizaLogger.info("Getting pool liquidity", { tokenA, tokenB, fee });

			// Sort tokens (lower address first as per Uniswap V3 convention)
			const [token0, token1] = sortTokens(tokenA, tokenB);

			// Get pool address
			const poolAddress = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: this.factoryAddress,
				method: "getPool",
				args: [token0, token1, fee],
				abi: ABIS.V3_CORE_FACTORY,
			});

			if (
				!poolAddress ||
				poolAddress === "0x0000000000000000000000000000000000000000"
			) {
				return "0"; // Pool doesn't exist
			}

			// Get pool liquidity
			const poolLiquidity = await this.contractHelper.invokeContract({
				networkId: this.networkId,
				contractAddress: poolAddress,
				method: "liquidity",
				args: [],
				abi: [
					{
						constant: true,
						inputs: [],
						name: "liquidity",
						outputs: [{ name: "", type: "uint128" }],
						type: "function",
					},
				],
			});

			return poolLiquidity.toString();
		} catch (error) {
			elizaLogger.error("Failed to get pool liquidity", {
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack, name: error.name }
						: error,
			});
			throw new Error(
				`Failed to get pool liquidity: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}
