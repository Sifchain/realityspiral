import {
	type IAgentRuntime,
	elizaLogger,
	type Action,
	type Memory,
	type State,
	type HandlerCallback,
} from "@elizaos/core";
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

// Helper function to get user address via ContractHelper
const getUserAddressString = async (
	runtime: IAgentRuntime,
	networkId: string,
): Promise<string> => {
	elizaLogger.info("Creating ContractHelper for getUserAddressString", {
		networkId,
	});
	const contractHelper = new ContractHelper(runtime);
	try {
		elizaLogger.info("Calling getUserAddress on ContractHelper", { networkId });
		const walletAddress = await contractHelper.getUserAddress(networkId);
		elizaLogger.info("Received wallet address", { walletAddress });
		
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
			error instanceof Error
				? {
						message: error.message,
						stack: error.stack,
						name: error.name,
					}
				: error,
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
	// Parse and validate configuration
	const fullConfig = PluginConfigSchema.parse({
		...config,
		network: config.network || "mainnet",
	});

	elizaLogger.info("Creating ContractHelper in accumulatedFinancePlugin");
	const contractHelper = new ContractHelper(runtime);
	elizaLogger.info("ContractHelper created successfully");

	// Get network configuration
	const networkConfig =
		fullConfig.network === "mainnet" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;

	// Initialize
	elizaLogger.info("Accumulated Finance plugin initialized", {
		network: fullConfig.network,
		privacyLevel: fullConfig.privacyLevel,
		contractAddresses: {
			wrappedRose: networkConfig.CONTRACTS.WRAPPED_ROSE,
			unwrappedRose: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
		},
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
		try {
			elizaLogger.info("Staking ROSE tokens", { amount, receiver });
			const targetReceiver =
				receiver || (await getUserAddressString(runtime, getNetworkId()));
			elizaLogger.info("Target receiver address", { targetReceiver });

			// First, we need to approve the wstROSE contract to spend our tokens
			elizaLogger.info("Preparing to approve token spending", {
				tokenContract: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
				spender: networkConfig.CONTRACTS.WRAPPED_ROSE,
				amount,
			});

			try {
				elizaLogger.info("Invoking approve on token contract");
				const approveResult = await contractHelper.invokeContract({
					networkId: getNetworkId(),
					contractAddress: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
					method: "approve",
					args: [networkConfig.CONTRACTS.WRAPPED_ROSE, amount],
					abi: ABIS.WSTROSE,
				});

				elizaLogger.info("Approved token spending", {
					hash: approveResult.status,
					details: approveResult,
				});
			} catch (approveError) {
				elizaLogger.error("Failed to approve token spending", {
					error:
						approveError instanceof Error
							? {
									message: approveError.message,
									stack: approveError.stack,
									name: approveError.name,
								}
							: approveError,
				});
				throw approveError;
			}

			// Now deposit into the wstROSE contract
			elizaLogger.info("Preparing to deposit tokens", {
				contract: networkConfig.CONTRACTS.WRAPPED_ROSE,
				assets: amount,
				receiver: targetReceiver,
			});

			try {
				elizaLogger.info("Invoking deposit on wstROSE contract");
				const depositResult = await contractHelper.invokeContract({
					networkId: getNetworkId(),
					contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
					method: "deposit",
					args: [amount, targetReceiver],
					abi: ABIS.WSTROSE,
				});

				elizaLogger.info("Deposit completed", {
					details: depositResult,
				});

				const result: StakingResult = {
					transactionHash:
						depositResult.transactionLink?.split("/").pop() || "",
					stakedAmount: amount, // Note: This is input amount, not shares received
					timestamp: Date.now(),
				};

				elizaLogger.info("Staking completed successfully", result);
				return result;
			} catch (depositError) {
				elizaLogger.error("Failed to deposit tokens", {
					error:
						depositError instanceof Error
							? {
									message: depositError.message,
									stack: depositError.stack,
									name: depositError.name,
								}
							: depositError,
				});
				throw depositError;
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			elizaLogger.error("Staking failed", {
				errorType:
					error instanceof Error ? error.constructor.name : typeof error,
				errorDetails:
					error instanceof Error
						? {
								message: error.message,
								stack: error.stack,
								name: error.name,
							}
						: error,
			});
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
				args: [amount, targetReceiver, ownerAddress],
				abi: ABIS.WSTROSE,
			});

			const txReceipt: TransactionReceipt = {
				transactionHash: result.transactionLink?.split("/").pop() || "",
				status: result.status === "SUCCESS",
				blockNumber: 0, // TODO: Populate if available from result
				events: {}, // TODO: Populate if available from result
			};

			return txReceipt;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			elizaLogger.error("Unstaking failed", error);
			throw new Error(`Unstaking failed: ${errorMessage}`);
		}
	};

	/**
	 * Get staking rewards information by checking the price per share
	 */
	const getRewards = async (): Promise<RewardInfo> => {
		try {
			const ownerAddress = await getUserAddressString(runtime, getNetworkId());

			// Get the price per share to indicate how much rewards have accumulated
			const pricePerShare = await contractHelper.readContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "pricePerShare",
				args: [],
				abi: ABIS.WSTROSE,
			});

			// Get user's wstROSE balance
			const shares = await contractHelper.readContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "balanceOf",
				args: [ownerAddress],
				abi: ABIS.WSTROSE,
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

			return rewardInfo;
		} catch (error: unknown) {
			elizaLogger.error("Failed to get rewards", error);
			throw new Error(
				`Failed to get rewards: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	};

	/**
	 * Claim staking rewards by syncing the rewards in the contract
	 * Note: This doesn't transfer rewards directly but updates the contract's internal accounting.
	 */
	const claimRewards = async (): Promise<TransactionReceipt> => {
		try {
			// Call syncRewards to refresh the rewards accounting within the contract
			const result = await contractHelper.invokeContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "syncRewards",
				args: [], // No arguments needed
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
			throw new Error(
				`Failed to claim rewards: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	};

	/**
	 * Get available staking strategies
	 * Since the contract only has one strategy, we'll return that
	 */
	const getStakingStrategies = async (): Promise<Strategy[]> => {
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
		try {
			const userAddress = await getUserAddressString(runtime, getNetworkId());

			// Get the user's wstROSE balance (shares)
			const wstRoseBalance = await contractHelper.readContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "balanceOf",
				args: [userAddress],
				abi: ABIS.WSTROSE,
			});

			// Convert wstROSE shares to underlying ROSE assets
			const roseAmount = await contractHelper.readContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "convertToAssets", // ERC4626 method to convert shares to assets
				args: [wstRoseBalance],
				abi: ABIS.WSTROSE, // Use the wstROSE ABI for this method
			});

			const balanceString = roseAmount.toString();

			return balanceString;
		} catch (error: unknown) {
			elizaLogger.error("Failed to get staked balance", error);
			throw new Error(
				`Failed to get staked balance: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	};

	/**
	 * Wrap native ROSE tokens to wROSE
	 * This is functionally equivalent to staking in the wstROSE contract.
	 */
	const wrapRose = async (amount: string): Promise<TransactionReceipt> => {
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

			return txReceipt;
		} catch (error: unknown) {
			elizaLogger.error("Failed to wrap ROSE", error);
			throw error instanceof Error
				? error
				: new Error(
						`Failed to wrap ROSE: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
		}
	};

	/**
	 * Unwrap wROSE to native ROSE tokens
	 * This is functionally equivalent to unstaking (withdrawing assets) from the wstROSE contract.
	 */
	const unwrapRose = async (amount: string): Promise<TransactionReceipt> => {
		try {
			// Call unstake function, providing the amount of ROSE (assets) to withdraw.
			// `unstake` handles the `withdraw` call correctly based on asset amount.
			const txReceiptResult = await unstake(amount);

			// Ensure txReceiptResult is correctly typed
			const typedTxReceipt = txReceiptResult as TransactionReceipt; // Explicit cast

			return typedTxReceipt; // Return cast result
		} catch (error: unknown) {
			elizaLogger.error("Failed to unwrap ROSE", error);
			throw error instanceof Error
				? error
				: new Error(
						`Failed to unwrap ROSE: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
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
			elizaLogger.info("Validating stakeAction: Creating ContractHelper");
			new ContractHelper(runtime); // Checks if runtime has necessary Coinbase settings implicitly
			elizaLogger.info("Validation successful: ContractHelper created");
			return true;
		} catch (e) {
			elizaLogger.error(
				"Validation failed for stakeAction: Coinbase/ContractHelper setup missing",
				e instanceof Error
					? {
							message: e.message,
							stack: e.stack,
							name: e.name,
						}
					: e,
			);
			return false;
		}
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		options?: any,
		callback?: HandlerCallback,
	): Promise<StakingResult> => {
		elizaLogger.info("stakeAction handler started", {
			options,
			runtimeDetails: {
				has_settings: !!runtime.getSetting,
			},
		});

		try {
			elizaLogger.info("Creating ContractHelper in stakeAction handler");
			const contractHelper = new ContractHelper(runtime);
			elizaLogger.info("Successfully created ContractHelper");

			const { networkConfig, networkId } = getConfigAndNetwork(runtime);
			elizaLogger.info("Network configuration", {
				networkId,
				networkConfig: {
					wrappedRose: networkConfig.CONTRACTS.WRAPPED_ROSE,
					unwrappedRose: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
				},
			});

			// TODO: Extract amount and receiver securely from message or options
			const amount = options?.amount || "10"; // Default to 10 ROSE if not specified
			const receiver = options?.receiver;
			elizaLogger.info("Stake parameters", { amount, receiver });

			try {
				elizaLogger.info("Getting user address");
				const userAddress = await getUserAddressString(runtime, networkId);
				elizaLogger.info("User address retrieved", { userAddress });
				const targetReceiver = receiver || userAddress;

				// Approve
				elizaLogger.info("Preparing to approve token spending", {
					tokenContract: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
					spender: networkConfig.CONTRACTS.WRAPPED_ROSE,
					amount,
				});

				try {
					const approveResult = await contractHelper.invokeContract({
						networkId: networkId,
						contractAddress: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
						method: "approve",
						args: [networkConfig.CONTRACTS.WRAPPED_ROSE, amount],
						abi: ABIS.WSTROSE,
					});

					elizaLogger.info("Approved token spending", {
						status: approveResult.status,
						details: approveResult,
					});
				} catch (approveError) {
					elizaLogger.error("Failed to approve token spending", {
						error:
							approveError instanceof Error
								? {
										message: approveError.message,
										stack: approveError.stack,
										name: approveError.name,
									}
								: approveError,
					});
					throw approveError;
				}

				// Deposit
				elizaLogger.info("Preparing to deposit tokens", {
					contract: networkConfig.CONTRACTS.WRAPPED_ROSE,
					assets: amount,
					receiver: targetReceiver,
				});

				try {
					const depositResult = await contractHelper.invokeContract({
						networkId: networkId,
						contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
						method: "deposit",
						args: [amount, targetReceiver],
						abi: ABIS.WSTROSE,
					});

					elizaLogger.info("Deposit completed", {
						status: depositResult.status,
						details: depositResult,
					});

					const result: StakingResult = {
						transactionHash:
							depositResult.transactionLink?.split("/").pop() || "",
						stakedAmount: amount,
						timestamp: Date.now(),
					};

					elizaLogger.info("Staking action completed successfully", result);

					if (callback)
						callback({
							text: `Staked ${amount} ROSE. Tx: ${result.transactionHash}`,
						});
					return result;
				} catch (depositError) {
					elizaLogger.error("Failed to deposit tokens", {
						error:
							depositError instanceof Error
								? {
										message: depositError.message,
										stack: depositError.stack,
										name: depositError.name,
									}
								: depositError,
					});
					throw depositError;
				}
			} catch (error) {
				elizaLogger.error("Error in user address or contract operations", {
					error:
						error instanceof Error
							? {
									message: error.message,
									stack: error.stack,
									name: error.name,
								}
							: error,
				});
				throw error;
			}
		} catch (error: unknown) {
			elizaLogger.error("Staking action failed", {
				errorType:
					error instanceof Error ? error.constructor.name : typeof error,
				errorDetails:
					error instanceof Error
						? {
								message: error.message,
								stack: error.stack,
								name: error.name,
							}
						: error,
			});

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
		const contractHelper = new ContractHelper(runtime);
		const { networkConfig, networkId } = getConfigAndNetwork(runtime);
		const amount = options?.amount || "0"; // Extract amount
		const receiver = options?.receiver; // Extract receiver

		try {
			const userAddress = await getUserAddressString(runtime, networkId);
			const targetReceiver = receiver || userAddress;
			const ownerAddress = userAddress;

			const result = await contractHelper.invokeContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "withdraw",
				args: [amount, targetReceiver, ownerAddress],
				abi: ABIS.WSTROSE,
			});

			const txReceipt: TransactionReceipt = {
				transactionHash: result.transactionLink?.split("/").pop() || "",
				status: result.status === "SUCCESS",
				blockNumber: 0, // TODO: Populate if available
				events: {}, // TODO: Populate if available
			};

			if (callback)
				callback({
					text: `Unstake initiated for ${amount} ROSE. Tx: ${txReceipt.transactionHash}`,
				});
			return txReceipt;
		} catch (error: unknown) {
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
		const contractHelper = new ContractHelper(runtime);
		const { networkConfig, networkId } = getConfigAndNetwork(runtime);

		try {
			const ownerAddress = await getUserAddressString(runtime, networkId);

			const pricePerShare = await contractHelper.readContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "pricePerShare",
				args: [],
				abi: ABIS.WSTROSE,
			});

			const shares = await contractHelper.readContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "balanceOf",
				args: [ownerAddress],
				abi: ABIS.WSTROSE,
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

			if (callback)
				callback({ text: `Pending rewards: ${rewardInfo.pendingRewards}` });
			return rewardInfo;
		} catch (error: unknown) {
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
		const contractHelper = new ContractHelper(runtime);
		const { networkConfig, networkId } = getConfigAndNetwork(runtime);

		try {
			// Call syncRewards to refresh the rewards accounting within the contract
			const result = await contractHelper.invokeContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "syncRewards",
				args: [], // No arguments needed
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
		const contractHelper = new ContractHelper(runtime);
		const { networkConfig, networkId } = getConfigAndNetwork(runtime);

		try {
			const userAddress = await getUserAddressString(runtime, networkId);

			// Get the user's wstROSE balance (shares)
			const wstRoseBalance = await contractHelper.readContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "balanceOf",
				args: [userAddress],
				abi: ABIS.WSTROSE,
			});

			// Convert wstROSE shares to underlying ROSE assets
			const roseAmount = await contractHelper.readContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "convertToAssets",
				args: [wstRoseBalance],
				abi: ABIS.WSTROSE,
			});

			const balanceString = roseAmount.toString();
			if (callback)
				callback({ text: `Your staked balance is ${balanceString} ROSE` });
			return balanceString;
		} catch (error: unknown) {
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
		const amount = options?.amount || "0";

		try {
			// Directly call stake handler logic
			const stakeResult = await stakeAction.handler(
				runtime,
				message,
				state,
				options,
			);

			// Ensure stakeResult is correctly typed before accessing properties
			const typedStakeResult = stakeResult as StakingResult;

			const txReceipt: TransactionReceipt = {
				transactionHash: typedStakeResult.transactionHash,
				status: !!typedStakeResult.transactionHash,
				blockNumber: 0,
				events: {},
			};

			if (callback)
				callback({
					text: `Wrap ROSE initiated. Tx: ${txReceipt.transactionHash}`,
				});
			return txReceipt;
		} catch (error: unknown) {
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
		const amount = options?.amount || "0";

		try {
			// Directly call unstake handler
			const txReceiptResult = await unstakeAction.handler(
				runtime,
				message,
				state,
				options,
			);

			// Ensure txReceiptResult is correctly typed
			const typedTxReceipt = txReceiptResult as TransactionReceipt;

			if (
				callback &&
				typedTxReceipt instanceof Object &&
				"transactionHash" in typedTxReceipt
			) {
				callback({
					text: `Unwrap ROSE initiated. Tx: ${typedTxReceipt.transactionHash}`,
				});
			}
			return typedTxReceipt;
		} catch (error: unknown) {
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