import {
	type IAgentRuntime,
	elizaLogger,
	type Action,
	type Memory,
	type State,
	type HandlerCallback,
} from "@elizaos/core";
import { Instrumentation } from "@realityspiral/plugin-instrumentation";
import {
	type StakingResult,
	type RewardInfo,
	type Strategy,
	type TransactionReceipt,
	type PluginConfig,
	PluginConfigSchema,
} from "../types";
import { ABIS, SAPPHIRE_MAINNET, SAPPHIRE_TESTNET } from "../constants";
import { ContractHelper } from "@realityspiral/plugin-coinbase";
import { ethers } from "ethers";

// Helper function to get user address via ContractHelper
const getUserAddressString = async (
	runtime: IAgentRuntime,
	networkId: string,
): Promise<string> => {
	const contractHelper = new ContractHelper(runtime);
	try {
		const walletAddress = await contractHelper.getUserAddress(networkId);
		const addressString = walletAddress as unknown as `0x${string}`;
		if (!addressString) {
			throw new Error(
				"User address string not found. Ensure wallet is connected and configured.",
			);
		}
		return addressString;
	} catch (error: unknown) {
		elizaLogger.error(
			"Failed to get user address string from ContractHelper",
			error instanceof Error ? error.message : error,
		);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Could not retrieve user address string: ${errorMessage}`);
	}
};

/**
 * Implementation of the Accumulated Finance plugin for Oasis Sapphire
 */
export const accumulatedFinancePlugin = (
	runtime: IAgentRuntime,
	config: Partial<PluginConfig> = {},
) => {
	// Get instrumentation singleton
	const instrumentation = Instrumentation.getInstance();

	// Parse and validate configuration
	const fullConfig = PluginConfigSchema.parse({
		...config,
		network: config.network || "mainnet",
	});

	// Create contract helper from plugin-coinbase
	const contractHelper = new ContractHelper(runtime);

	// Get network configuration
	const networkConfig =
		fullConfig.network === "mainnet" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;

	// Initialize
	elizaLogger.info("Accumulated Finance plugin initialized", {
		network: fullConfig.network,
		privacyLevel: fullConfig.privacyLevel,
	});

	// Add warning for missing testnet addresses
	if (fullConfig.network === "testnet") {
		if (
			!networkConfig.CONTRACTS.WRAPPED_ROSE ||
			!networkConfig.CONTRACTS.UNWRAPPED_ROSE
		) {
			elizaLogger.warn(
				"Accumulated Finance Testnet configuration is missing contract addresses. Plugin may not function correctly.",
			);
			// TODO: Add actual testnet addresses to constants.ts
		}
	}

	// Map Oasis network to the correct numeric Chain ID expected by EVM tools/SDKs
	const getNetworkId = () => {
		// Mainnet: 23294 (0x5afe)
		// Testnet: 23295 (0x5aff)
		return fullConfig.network === "mainnet" ? "23294" : "23295";
	};

	/**
	 * Stake ROSE tokens to earn rewards by depositing into the wstROSE contract
	 * This implements the ERC4626 deposit standard
	 */
	const stake = async (
		amount: string,
		receiver?: string,
	): Promise<StakingResult> => {
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "stake",
			event: "requested",
			data: { amount, receiver } as unknown as Record<string, unknown>,
		});

		try {
			const targetReceiver =
				receiver || (await getUserAddressString(runtime, getNetworkId()));

			// First, we need to approve the wstROSE contract to spend our tokens
			const approveResult = await contractHelper.invokeContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
				method: "approve",
				args: {
					spender: networkConfig.CONTRACTS.WRAPPED_ROSE,
					amount: amount,
				},
				abi: ABIS.ERC20,
			});

			elizaLogger.info("Approved token spending", {
				hash: approveResult.status, // Assuming status contains hash or identifier
			});

			// Now deposit into the wstROSE contract
			const depositResult = await contractHelper.invokeContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "deposit",
				args: {
					assets: amount,
					receiver: targetReceiver,
				},
				abi: ABIS.WSTROSE,
			});

			const result: StakingResult = {
				transactionHash: depositResult.transactionLink?.split("/").pop() || "",
				stakedAmount: amount, // Note: This is input amount, not shares received
				timestamp: Date.now(),
			};

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "stake",
				event: "success",
				data: result as unknown as Record<string, unknown>,
			});

			return result;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "stake",
				event: "error",
				data: { error: errorMessage, amount, receiver } as unknown as Record<
					string,
					unknown
				>,
			});

			elizaLogger.error("Staking failed", error);
			throw new Error(`Staking failed: ${errorMessage}`);
		}
	};

	/**
	 * Unstake ROSE tokens - withdraw from the wstROSE contract
	 */
	const unstake = async (
		amount: string,
		receiver?: string,
	): Promise<TransactionReceipt> => {
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "unstake",
			event: "requested",
			data: { amount, receiver } as unknown as Record<string, unknown>,
		});

		try {
			const targetReceiver =
				receiver || (await getUserAddressString(runtime, getNetworkId()));
			const ownerAddress = await getUserAddressString(runtime, getNetworkId()); // Owner is the caller

			// Call the withdraw function on the wstROSE contract
			// Withdraw takes the amount of *assets* (ROSE) to withdraw
			const result = await contractHelper.invokeContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "withdraw",
				args: {
					assets: amount,
					receiver: targetReceiver,
					owner: ownerAddress, // The account initiating the withdrawal
				},
				abi: ABIS.WSTROSE,
			});

			const txReceipt: TransactionReceipt = {
				transactionHash: result.transactionLink?.split("/").pop() || "",
				status: result.status === "SUCCESS",
				blockNumber: 0, // TODO: Populate if available from result
				events: {}, // TODO: Populate if available from result
			};

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "unstake",
				event: "success",
				data: txReceipt as unknown as Record<string, unknown>,
			});

			return txReceipt;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "unstake",
				event: "error",
				data: { error: errorMessage, amount, receiver } as unknown as Record<
					string,
					unknown
				>,
			});
			elizaLogger.error("Unstaking failed", error);
			throw new Error(`Unstaking failed: ${errorMessage}`);
		}
	};

	/**
	 * Get staking rewards information by checking the price per share
	 */
	const getRewards = async (): Promise<RewardInfo> => {
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "rewards",
			event: "requested",
			data: {} as unknown as Record<string, unknown>,
		});

		try {
			const ownerAddress = await getUserAddressString(runtime, getNetworkId());

			// Get the price per share to indicate how much rewards have accumulated
			const pricePerShare = await contractHelper.readContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "pricePerShare",
				args: {},
				abi: ABIS.WSTROSE,
			});

			// Get user's wstROSE balance
			const shares = await contractHelper.readContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "balanceOf",
				args: {
					_owner: ownerAddress,
				},
				abi: ABIS.ERC20,
			});

			const sharesBigInt = BigInt(shares);
			const pricePerShareBigInt = BigInt(pricePerShare);
			const scaleFactor = BigInt(10 ** 18); // Assuming 18 decimals for pricePerShare

			// Current value of shares in underlying ROSE terms
			const currentValue = (sharesBigInt * pricePerShareBigInt) / scaleFactor;

			// Simplified original value assuming 1:1 deposit
			const originalValue = sharesBigInt;

			const pendingRewards =
				currentValue > originalValue
					? (currentValue - originalValue).toString()
					: "0";

			const rewardInfo: RewardInfo = {
				pendingRewards: pendingRewards,
				claimedRewards: "0", // Claimed rewards are inherently reflected in the increased share value
				lastClaimTimestamp: Date.now(), // Placeholder, actual claim timestamp isn't tracked here
			};

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "rewards",
				event: "success",
				data: rewardInfo as unknown as Record<string, unknown>,
			});

			return rewardInfo;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "rewards",
				event: "error",
				data: { error: errorMessage } as unknown as Record<string, unknown>,
			});
			elizaLogger.error("Failed to get rewards", error);
			throw new Error(`Failed to get rewards: ${errorMessage}`);
		}
	};

	/**
	 * Claim staking rewards by syncing the rewards in the contract
	 * Note: This doesn't transfer rewards directly but updates the contract's internal accounting.
	 */
	const claimRewards = async (): Promise<TransactionReceipt> => {
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "rewards",
			event: "claim",
			data: {} as unknown as Record<string, unknown>,
		});

		try {
			// Call syncRewards to refresh the rewards accounting within the contract
			const result = await contractHelper.invokeContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "syncRewards",
				args: {}, // No arguments needed
				abi: ABIS.WSTROSE,
			});

			const txReceipt: TransactionReceipt = {
				transactionHash: result.transactionLink?.split("/").pop() || "",
				status: result.status === "SUCCESS",
				blockNumber: 0, // TODO: Populate if available
				events: {}, // TODO: Populate if available
			};

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "rewards",
				event: "claim-success",
				data: txReceipt as unknown as Record<string, unknown>,
			});

			return txReceipt;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "rewards",
				event: "claim-error",
				data: { error: errorMessage } as unknown as Record<string, unknown>,
			});
			elizaLogger.error("Failed to claim rewards", error);
			throw new Error(`Failed to claim rewards: ${errorMessage}`);
		}
	};

	/**
	 * Get available staking strategies
	 * Since the contract only has one strategy, we'll return that
	 */
	const getStakingStrategies = async (): Promise<Strategy[]> => {
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "strategies",
			event: "requested",
			data: {} as unknown as Record<string, unknown>,
		});

		// The wstROSE contract represents a single staking strategy
		return [
			{
				id: "default",
				name: "Accumulated Finance ROSE Staking",
				description:
					"Stake ROSE tokens into the wstROSE ERC4626 vault to earn staking rewards.",
				riskLevel: "low", // Subjective, based on contract/protocol risk
				estimatedApy: "8-10%",
				lockupPeriod: "None", // No enforced lockup in the wstROSE contract itself
			},
		];
	};

	/**
	 * Get staked balance by converting the wstROSE balance to the underlying asset (ROSE)
	 */
	const getStakedBalance = async (): Promise<string> => {
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "balance",
			event: "requested",
			data: {} as unknown as Record<string, unknown>,
		});

		try {
			const userAddress = await getUserAddressString(runtime, getNetworkId());

			// Get the user's wstROSE balance (shares)
			const wstRoseBalance = await contractHelper.readContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "balanceOf",
				args: { _owner: userAddress }, // Ensure argument name matches ABI (_owner vs owner)
				abi: ABIS.ERC20, // Use standard ERC20 ABI for balanceOf
			});

			// Convert wstROSE shares to underlying ROSE assets
			const roseAmount = await contractHelper.readContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "convertToAssets", // ERC4626 method to convert shares to assets
				args: { shares: wstRoseBalance },
				abi: ABIS.WSTROSE, // Use the wstROSE ABI for this method
			});

			const balanceString = roseAmount.toString();

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "balance",
				event: "success",
				data: { balance: balanceString } as unknown as Record<string, unknown>,
			});

			return balanceString;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "balance",
				event: "error",
				data: { error: errorMessage } as unknown as Record<string, unknown>,
			});
			elizaLogger.error("Failed to get staked balance", error);
			throw new Error(`Failed to get staked balance: ${errorMessage}`);
		}
	};

	/**
	 * Wrap native ROSE tokens to wROSE
	 * This is functionally equivalent to staking in the wstROSE contract.
	 */
	const wrapRose = async (amount: string): Promise<TransactionReceipt> => {
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "wrap",
			event: "requested",
			data: { amount } as unknown as Record<string, unknown>,
		});

		try {
			// Call stake function, as wrapping ROSE is depositing into the wstROSE vault
			const stakeResult = await stake(amount);

			// Adapt the StakingResult to TransactionReceipt format
			const txReceipt: TransactionReceipt = {
				transactionHash: stakeResult.transactionHash,
				status: !!stakeResult.transactionHash, // Consider success if hash exists
				blockNumber: 0, // Not available from stakeResult
				events: {}, // Not available from stakeResult
			};

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "wrap",
				event: "success",
				data: txReceipt as unknown as Record<string, unknown>,
			});

			return txReceipt;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "wrap",
				event: "error",
				data: { error: errorMessage, amount } as unknown as Record<
					string,
					unknown
				>,
			});
			elizaLogger.error("Failed to wrap ROSE", error);
			throw error instanceof Error
				? error
				: new Error(`Failed to wrap ROSE: ${errorMessage}`);
		}
	};

	/**
	 * Unwrap wROSE to native ROSE tokens
	 * This is functionally equivalent to unstaking (withdrawing assets) from the wstROSE contract.
	 */
	const unwrapRose = async (amount: string): Promise<TransactionReceipt> => {
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "unwrap",
			event: "requested",
			data: { amount } as unknown as Record<string, unknown>,
		});

		try {
			// Call unstake function, providing the amount of ROSE (assets) to withdraw.
			// `unstake` handles the `withdraw` call correctly based on asset amount.
			const txReceiptResult = await unstake(amount);

			// Ensure txReceiptResult is correctly typed
			const typedTxReceipt = txReceiptResult as TransactionReceipt; // Explicit cast

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "unwrap",
				event: "success",
				data: typedTxReceipt as unknown as Record<string, unknown>,
			});

			return typedTxReceipt; // Return cast result
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "unwrap",
				event: "error",
				data: { error: errorMessage, amount } as unknown as Record<
					string,
					unknown
				>,
			});
			elizaLogger.error("Failed to unwrap ROSE", error);
			throw error instanceof Error
				? error
				: new Error(`Failed to unwrap ROSE: ${errorMessage}`);
		}
	};

	// Expose plugin functions
	return {
		stake,
		unstake,
		getRewards,
		claimRewards,
		getStakingStrategies,
		getStakedBalance,
		wrapRose,
		unwrapRose,
	};
};

// Helper function to get configuration and network details
const getConfigAndNetwork = (runtime: IAgentRuntime) => {
	// TODO: How to pass config effectively? Maybe via runtime settings?
	const config: Partial<PluginConfig> = {
		network:
			(runtime.getSetting(
				"ACCUMULATED_FINANCE_NETWORK",
			) as PluginConfig["network"]) || "mainnet",
		// privateKey and walletSeed could also be sourced from settings if needed,
		// but ContractHelper likely handles this via Coinbase SDK's wallet management.
	};
	const fullConfig = PluginConfigSchema.parse(config);
	const networkConfig =
		fullConfig.network === "mainnet" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;
	const networkId = fullConfig.network === "mainnet" ? "23294" : "23295";

	// Add warning for missing testnet addresses
	if (fullConfig.network === "testnet") {
		if (
			!networkConfig.CONTRACTS.WRAPPED_ROSE ||
			!networkConfig.CONTRACTS.UNWRAPPED_ROSE
		) {
			elizaLogger.warn(
				"Accumulated Finance Testnet configuration is missing contract addresses. Plugin may not function correctly.",
			);
		}
	}

	return { fullConfig, networkConfig, networkId };
};

// --- Action Definitions ---

export const stakeAction: Action = {
	name: "ACCUMULATED_FINANCE_STAKE",
	description: "Stake ROSE tokens on Accumulated Finance",
	similes: ["STAKE_ON_ACCUMULATED", "DEPOSIT_ROSE_ACCUMULATED"],
	examples: [],
	validate: async (runtime: IAgentRuntime) => {
		// Basic validation: Check if ContractHelper can be initialized (implies Coinbase setup)
		try {
			new ContractHelper(runtime); // Checks if runtime has necessary Coinbase settings implicitly
			return true;
		} catch (e) {
			elizaLogger.error(
				"Validation failed for stakeAction: Coinbase/ContractHelper setup missing",
				e,
			);
			return false;
		}
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory, // Assuming amount and optional receiver are in message.content
		state?: State,
		options?: any, // Use options for amount/receiver if not in message
		callback?: HandlerCallback,
	): Promise<StakingResult> => {
		const instrumentation = Instrumentation.getInstance();
		const contractHelper = new ContractHelper(runtime);
		const { networkConfig, networkId } = getConfigAndNetwork(runtime);
		// TODO: Extract amount and receiver securely from message or options
		const amount = options?.amount || "0"; // Replace with actual extraction logic
		const receiver = options?.receiver; // Replace with actual extraction logic

		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "stake",
			event: "requested",
			data: { amount, receiver } as unknown as Record<string, unknown>,
		});

		try {
			const userAddress = await getUserAddressString(runtime, networkId);
			const targetReceiver = receiver || userAddress;

			// Approve
			const approveResult = await contractHelper.invokeContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
				method: "approve",
				args: {
					spender: networkConfig.CONTRACTS.WRAPPED_ROSE,
					amount: amount,
				},
				abi: ABIS.ERC20,
			});
			elizaLogger.info("Approved token spending", {
				hash: approveResult.status,
			});

			// Deposit
			const depositResult = await contractHelper.invokeContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "deposit",
				args: {
					assets: amount,
					receiver: targetReceiver,
				},
				abi: ABIS.WSTROSE,
			});

			const result: StakingResult = {
				transactionHash: depositResult.transactionLink?.split("/").pop() || "",
				stakedAmount: amount,
				timestamp: Date.now(),
			};

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "stake",
				event: "success",
				data: result as any,
			});

			if (callback)
				callback({
					text: `Staked ${amount} ROSE. Tx: ${result.transactionHash}`,
				});
			return result;
		} catch (error: unknown) {
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "stake",
				event: "error",
				data: { error, amount, receiver } as any,
			});
			elizaLogger.error("Staking failed", error);
			if (callback && error instanceof Error) {
				callback({ text: `Staking failed: ${error.message}` });
			} else if (callback) {
				callback({ text: `Staking failed: Unknown error` });
			}
			throw error;
		}
	},
};

export const unstakeAction: Action = {
	name: "ACCUMULATED_FINANCE_UNSTAKE",
	description: "Unstake ROSE tokens from Accumulated Finance",
	similes: ["UNSTAKE_FROM_ACCUMULATED", "WITHDRAW_ROSE_ACCUMULATED"],
	examples: [],
	validate: async (runtime: IAgentRuntime) => {
		try {
			new ContractHelper(runtime);
			return true;
		} catch (e) {
			return false;
		}
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: any,
		callback?: HandlerCallback,
	): Promise<TransactionReceipt> => {
		const instrumentation = Instrumentation.getInstance();
		const contractHelper = new ContractHelper(runtime);
		const { networkConfig, networkId } = getConfigAndNetwork(runtime);
		const amount = options?.amount || "0"; // Extract amount
		const receiver = options?.receiver; // Extract receiver

		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "unstake",
			event: "requested",
			data: { amount, receiver } as any,
		});

		try {
			const userAddress = await getUserAddressString(runtime, networkId);
			const targetReceiver = receiver || userAddress;
			const ownerAddress = userAddress;

			const result = await contractHelper.invokeContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "withdraw",
				args: {
					assets: amount,
					receiver: targetReceiver,
					owner: ownerAddress,
				},
				abi: ABIS.WSTROSE,
			});

			const txReceipt: TransactionReceipt = {
				transactionHash: result.transactionLink?.split("/").pop() || "",
				status: result.status === "SUCCESS",
				blockNumber: 0, // TODO: Populate if available
				events: {}, // TODO: Populate if available
			};

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "unstake",
				event: "success",
				data: txReceipt as any,
			});

			if (callback)
				callback({
					text: `Unstake initiated for ${amount} ROSE. Tx: ${txReceipt.transactionHash}`,
				});
			return txReceipt;
		} catch (error: unknown) {
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "unstake",
				event: "error",
				data: { error, amount, receiver } as any,
			});
			elizaLogger.error("Unstaking failed", error);
			if (callback && error instanceof Error) {
				callback({ text: `Unstaking failed: ${error.message}` });
			} else if (callback) {
				callback({ text: `Unstaking failed: Unknown error` });
			}
			throw error;
		}
	},
};

export const getRewardsAction: Action = {
	name: "ACCUMULATED_FINANCE_GET_REWARDS",
	description: "Get accumulated staking rewards from Accumulated Finance",
	similes: ["CHECK_ACCUMULATED_REWARDS"],
	examples: [],
	validate: async (runtime: IAgentRuntime) => {
		try {
			new ContractHelper(runtime);
			return true;
		} catch (e) {
			return false;
		}
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: any,
		callback?: HandlerCallback,
	): Promise<RewardInfo> => {
		const instrumentation = Instrumentation.getInstance();
		const contractHelper = new ContractHelper(runtime);
		const { networkConfig, networkId } = getConfigAndNetwork(runtime);

		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "rewards",
			event: "requested",
			data: {},
		});

		try {
			const ownerAddress = await getUserAddressString(runtime, networkId);

			const pricePerShare = await contractHelper.readContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "pricePerShare",
				args: {},
				abi: ABIS.WSTROSE,
			});

			const shares = await contractHelper.readContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "balanceOf",
				args: { _owner: ownerAddress },
				abi: ABIS.ERC20,
			});

			const sharesBigInt = BigInt(shares);
			const pricePerShareBigInt = BigInt(pricePerShare);
			const scaleFactor = BigInt(10 ** 18);
			const currentValue = (sharesBigInt * pricePerShareBigInt) / scaleFactor;
			const originalValue = sharesBigInt;
			const pendingRewards =
				currentValue > originalValue
					? (currentValue - originalValue).toString()
					: "0";

			const rewardInfo: RewardInfo = {
				pendingRewards: pendingRewards,
				claimedRewards: "0",
				lastClaimTimestamp: Date.now(),
			};

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "rewards",
				event: "success",
				data: rewardInfo as any,
			});
			if (callback)
				callback({ text: `Pending rewards: ${rewardInfo.pendingRewards}` });
			return rewardInfo;
		} catch (error: unknown) {
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "rewards",
				event: "error",
				data: { error } as any,
			});
			elizaLogger.error("Failed to get rewards", error);
			if (callback && error instanceof Error) {
				callback({ text: `Failed to get rewards: ${error.message}` });
			} else if (callback) {
				callback({ text: `Failed to get rewards: Unknown error` });
			}
			throw error;
		}
	},
};

export const claimRewardsAction: Action = {
	name: "ACCUMULATED_FINANCE_CLAIM_REWARDS",
	description: "Claim staking rewards from Accumulated Finance (syncs rewards)",
	similes: ["CLAIM_ACCUMULATED_REWARDS", "SYNC_ACCUMULATED_REWARDS"],
	examples: [],
	validate: async (runtime: IAgentRuntime) => {
		try {
			new ContractHelper(runtime);
			return true;
		} catch (e) {
			return false;
		}
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: any,
		callback?: HandlerCallback,
	): Promise<TransactionReceipt> => {
		const instrumentation = Instrumentation.getInstance();
		const contractHelper = new ContractHelper(runtime);
		const { networkConfig, networkId } = getConfigAndNetwork(runtime);

		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "rewards",
			event: "claim",
			data: {},
		});

		try {
			// Call syncRewards to refresh the rewards accounting within the contract
			const result = await contractHelper.invokeContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "syncRewards",
				args: {}, // No arguments needed
				abi: ABIS.WSTROSE,
			});

			return {
				transactionHash: result.transactionLink?.split("/").pop() || "",
				status: result.status === "SUCCESS",
				blockNumber: 0, // TODO: Populate if available
				events: {}, // TODO: Populate if available
			};
		} catch (error: unknown) {
			elizaLogger.error("Failed to claim rewards", error);
			if (callback && error instanceof Error) {
				callback({ text: `Failed to claim rewards: ${error.message}` });
			} else if (callback) {
				callback({ text: `Failed to claim rewards: Unknown error` });
			}
			throw error;
		}
	},
};

export const getStakingStrategiesAction: Action = {
	name: "ACCUMULATED_FINANCE_GET_STRATEGIES",
	description: "Get available staking strategies for Accumulated Finance",
	similes: ["LIST_ACCUMULATED_STRATEGIES"],
	examples: [],
	validate: async () => true,
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: any,
		callback?: HandlerCallback,
	): Promise<Strategy[]> => {
		const instrumentation = Instrumentation.getInstance();
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "strategies",
			event: "requested",
			data: {},
		});

		const strategies: Strategy[] = [
			{
				id: "default",
				name: "Accumulated Finance ROSE Staking",
				description:
					"Stake ROSE tokens into the wstROSE ERC4626 vault to earn staking rewards.",
				riskLevel: "low",
				estimatedApy: "8-10%",
				lockupPeriod: "None",
			},
		];

		if (callback)
			callback({ text: `Available strategy: ${strategies[0].name}` });
		return strategies;
	},
};

export const getStakedBalanceAction: Action = {
	name: "ACCUMULATED_FINANCE_GET_STAKED_BALANCE",
	description: "Get the staked ROSE balance from Accumulated Finance",
	similes: ["CHECK_ACCUMULATED_BALANCE"],
	examples: [],
	validate: async (runtime: IAgentRuntime) => {
		try {
			new ContractHelper(runtime);
			return true;
		} catch (e) {
			return false;
		}
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: any,
		callback?: HandlerCallback,
	): Promise<string> => {
		const instrumentation = Instrumentation.getInstance();
		const contractHelper = new ContractHelper(runtime);
		const { networkConfig, networkId } = getConfigAndNetwork(runtime);

		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "balance",
			event: "requested",
			data: {},
		});

		try {
			const userAddress = await getUserAddressString(runtime, networkId);

			// Get the user's wstROSE balance (shares)
			const wstRoseBalance = await contractHelper.readContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "balanceOf",
				args: { _owner: userAddress },
				abi: ABIS.ERC20,
			});

			// Convert wstROSE shares to underlying ROSE assets
			const roseAmount = await contractHelper.readContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "convertToAssets",
				args: { shares: wstRoseBalance },
				abi: ABIS.WSTROSE,
			});

			const balanceString = roseAmount.toString();
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "balance",
				event: "success",
				data: { balance: balanceString },
			});
			if (callback)
				callback({ text: `Your staked balance is ${balanceString} ROSE` });
			return balanceString;
		} catch (error: unknown) {
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "balance",
				event: "error",
				data: { error } as any,
			});
			elizaLogger.error("Failed to get staked balance", error);
			if (callback && error instanceof Error) {
				callback({ text: `Failed to get staked balance: ${error.message}` });
			} else if (callback) {
				callback({ text: `Failed to get staked balance: Unknown error` });
			}
			throw error;
		}
	},
};

// --- Wrapper Actions (wrapRose/unwrapRose) ---
// These map directly to stake/unstake but provide clearer intent

export const wrapRoseAction: Action = {
	name: "ACCUMULATED_FINANCE_WRAP_ROSE",
	description: "Wrap native ROSE into wstROSE (equivalent to staking)",
	similes: ["WRAP_ROSE_ACCUMULATED"],
	examples: [],
	validate: stakeAction.validate,
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: any,
		callback?: HandlerCallback,
	): Promise<TransactionReceipt> => {
		const instrumentation = Instrumentation.getInstance();
		const amount = options?.amount || "0";
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "wrap",
			event: "requested",
			data: { amount } as any,
		});
		try {
			const stakeResult = await stakeAction.handler(
				runtime,
				message,
				state,
				options,
			);

			// Ensure stakeResult is correctly typed before accessing properties
			const typedStakeResult = stakeResult as StakingResult; // Explicit cast

			const txReceipt: TransactionReceipt = {
				transactionHash: typedStakeResult.transactionHash, // Use cast result
				status: !!typedStakeResult.transactionHash, // Use cast result
				blockNumber: 0,
				events: {},
			};
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "wrap",
				event: "success",
				data: txReceipt as any,
			});
			if (callback)
				callback({
					text: `Wrap ROSE initiated. Tx: ${txReceipt.transactionHash}`,
				});
			return txReceipt;
		} catch (error: unknown) {
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "wrap",
				event: "error",
				data: { error, amount } as any,
			});
			elizaLogger.error("Failed to wrap ROSE", error);
			if (callback && error instanceof Error) {
				callback({ text: `Failed to wrap ROSE: ${error.message}` });
			} else if (callback) {
				callback({ text: `Failed to wrap ROSE: Unknown error` });
			}
			throw error;
		}
	},
};

export const unwrapRoseAction: Action = {
	name: "ACCUMULATED_FINANCE_UNWRAP_ROSE",
	description: "Unwrap wstROSE back to native ROSE (equivalent to unstaking)",
	similes: ["UNWRAP_ROSE_ACCUMULATED"],
	examples: [],
	validate: unstakeAction.validate,
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: any,
		callback?: HandlerCallback,
	): Promise<TransactionReceipt> => {
		const instrumentation = Instrumentation.getInstance();
		const amount = options?.amount || "0";
		instrumentation.logEvent({
			stage: "accumulated-finance",
			subStage: "unwrap",
			event: "requested",
			data: { amount } as any,
		});
		try {
			const txReceiptResult = await unstakeAction.handler(
				runtime,
				message,
				state,
				options,
			);

			// Ensure txReceiptResult is correctly typed
			const typedTxReceipt = txReceiptResult as TransactionReceipt; // Explicit cast

			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "unwrap",
				event: "success",
				data: typedTxReceipt as unknown as Record<string, unknown>,
			});
			if (
				callback &&
				typedTxReceipt instanceof Object &&
				"transactionHash" in typedTxReceipt
			) {
				callback({
					text: `Unwrap ROSE initiated. Tx: ${typedTxReceipt.transactionHash}`,
				});
			}
			return typedTxReceipt; // Return cast result
		} catch (error: unknown) {
			instrumentation.logEvent({
				stage: "accumulated-finance",
				subStage: "unwrap",
				event: "error",
				data: { error, amount } as any,
			});
			elizaLogger.error("Failed to unwrap ROSE", error);
			if (callback && error instanceof Error) {
				callback({ text: `Failed to unwrap ROSE: ${error.message}` });
			} else if (callback) {
				callback({ text: `Failed to unwrap ROSE: Unknown error` });
			}
			throw error;
		}
	},
};