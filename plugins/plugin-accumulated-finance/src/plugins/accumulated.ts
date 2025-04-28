import {
	type Action,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	type State,
	elizaLogger,
} from "@elizaos/core";
import { ContractHelper } from "@realityspiral/plugin-coinbase";
import { ABIS, SAPPHIRE_MAINNET, SAPPHIRE_TESTNET } from "../constants";
import {
	type PluginConfig,
	PluginConfigSchema,
	type RewardInfo,
	type StakingResult,
	type Strategy,
	type TransactionReceipt,
} from "../types";

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

	/**
	 * Mint a specific number of wstROSE shares
	 * This implements the ERC4626 mint standard
	 */
	const mint = async (
		sharesAmount: string,
		receiver?: string,
	): Promise<StakingResult> => {
		try {
			elizaLogger.info("Minting wstROSE shares", { sharesAmount, receiver });
			const targetReceiver =
				receiver || (await getUserAddressString(runtime, getNetworkId()));
			elizaLogger.info("Target receiver address", { targetReceiver });

			// // Get the asset amount required for minting the specified shares
			// const assetsRequired = await contractHelper.readContract({
			// 	networkId: getNetworkId(),
			// 	contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
			// 	method: "previewMint",
			// 	args: [sharesAmount],
			// 	abi: ABIS.WSTROSE,
			// });

			// elizaLogger.info("Assets required for mint", { assetsRequired });

			// First, approve the wstROSE contract to spend the required assets
			// elizaLogger.info("Preparing to approve token spending", {
			// 	tokenContract: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
			// 	spender: networkConfig.CONTRACTS.WRAPPED_ROSE,
			// 	amount: sharesAmount.toString(),
			// });

			// try {
			// 	elizaLogger.info("Invoking approve on token contract");
			// 	const approveResult = await contractHelper.invokeContract({
			// 		networkId: getNetworkId(),
			// 		contractAddress: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
			// 		method: "approve",
			// 		args: [networkConfig.CONTRACTS.WRAPPED_ROSE, sharesAmount.toString()],
			// 		abi: ABIS.WSTROSE,
			// 	});

			// 	elizaLogger.info("Approved token spending", {
			// 		hash: approveResult.status,
			// 		details: approveResult,
			// 	});
			// } catch (approveError) {
			// 	elizaLogger.error("Failed to approve token spending", {
			// 		error:
			// 			approveError instanceof Error
			// 				? {
			// 						message: approveError.message,
			// 						stack: approveError.stack,
			// 						name: approveError.name,
			// 					}
			// 				: approveError,
			// 	});
			// 	throw approveError;
			// }

			// Now mint the shares
			elizaLogger.info("Preparing to mint shares", {
				contract: networkConfig.CONTRACTS.WRAPPED_ROSE,
				shares: sharesAmount,
				receiver: targetReceiver,
			});

			try {
				elizaLogger.info("Invoking mint on wstROSE contract");
				const depositResult = await contractHelper.invokeContract({
					networkId: "23294", // Oasis Sapphire mainnet chain ID
					contractAddress: networkConfig.CONTRACTS.UNSTAKED_ROSE,
					method: "deposit",
					args: [targetReceiver],
					amount: sharesAmount,
					assetId: "0x0000000000000000000000000000000000000000", // Native token asset ID
					abi: ABIS.STROSE,
				});

				elizaLogger.info("Deposit completed", {
					status: depositResult.status,
					details: depositResult,
				});

				const result: StakingResult = {
					transactionHash:
						depositResult.transactionLink?.split("/").pop() || "",
					stakedAmount: sharesAmount.toString(),
					timestamp: Date.now(),
				};

				elizaLogger.info("Minting completed successfully", result);
				return result;
			} catch (mintError) {
				elizaLogger.error("Failed to mint shares", {
					error:
						mintError instanceof Error
							? {
									message: mintError.message,
									stack: mintError.stack,
									name: mintError.name,
								}
							: mintError,
				});
				throw mintError;
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			elizaLogger.error("Minting failed", {
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
			throw new Error(`Minting failed: ${errorMessage}`);
		}
	};

	/**
	 * Approve token spending for a specific contract
	 */
	const approve = async (
		tokenAddress: string,
		spenderAddress: string,
		amount: string,
	): Promise<TransactionReceipt> => {
		try {
			elizaLogger.info("Approving token spending", {
				tokenAddress,
				spenderAddress,
				amount,
			});

			const result = await contractHelper.invokeContract({
				networkId: getNetworkId(),
				contractAddress: tokenAddress,
				method: "approve",
				args: [spenderAddress, amount],
				abi: ABIS.ERC20,
			});

			elizaLogger.info("Approval completed", {
				details: result,
			});

			const txReceipt: TransactionReceipt = {
				transactionHash: result.transactionLink?.split("/").pop() || "",
				status: result.status === "SUCCESS",
				blockNumber: 0,
				events: {},
			};

			return txReceipt;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			elizaLogger.error("Approval failed", error);
			throw new Error(`Approval failed: ${errorMessage}`);
		}
	};

	/**
	 * Redeem a specific number of shares to receive underlying assets (ROSE)
	 * This implements the ERC4626 redeem standard
	 */
	const redeem = async (
		shares: string,
		receiver?: string,
		owner?: string,
	): Promise<TransactionReceipt> => {
		try {
			elizaLogger.info("Redeeming wstROSE shares for ROSE", {
				shares,
				receiver,
				owner,
			});

			const targetReceiver =
				receiver || (await getUserAddressString(runtime, getNetworkId()));
			const shareOwner =
				owner || (await getUserAddressString(runtime, getNetworkId()));

			elizaLogger.info("Redeem parameters", {
				shares,
				receiver: targetReceiver,
				owner: shareOwner,
			});

			// Call the redeem function on the wstROSE contract
			const result = await contractHelper.invokeContract({
				networkId: getNetworkId(),
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "redeem",
				args: [shares, targetReceiver, shareOwner],
				abi: ABIS.WSTROSE,
			});

			elizaLogger.info("Redeem completed", {
				details: result,
			});

			const txReceipt: TransactionReceipt = {
				transactionHash: result.transactionLink?.split("/").pop() || "",
				status: result.status === "SUCCESS",
				blockNumber: 0,
				events: {},
			};

			return txReceipt;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			elizaLogger.error("Redeem operation failed", error);
			throw new Error(`Failed to redeem shares: ${errorMessage}`);
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
		mint,
		approve,
		redeem,

		// Add explicit standard ERC4626 naming aliases
		deposit: stake,
		withdraw: unstake,
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
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "I want to stake 10 ROSE tokens on Accumulated Finance",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Staked 10 ROSE. Tx: 0x3a8d706eed54b7b13f53e2a1639e0fff35ad5458c62af97d629b4bfcdb42e1a9",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Stake 50 ROSE to earn rewards",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Staked 50 ROSE. Tx: 0x8c76a1137d31a3b7f5ccc29aa31f91436745e27d8865acc0cd4cdcb8ae34368f",
				},
			},
		],
	],
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
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "I want to unstake 20 ROSE tokens",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unstake initiated for 20 ROSE. Tx: 0x2d83f2c812a6d8d7707733782e13e767a79f24fbce0dbcd9d5115ffc8a9daed0",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Withdraw all my staked ROSE",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unstake initiated for 100 ROSE. Tx: 0xc4e76828390784983d67594e6a256983c543f334a7bef7931f982ba55095551f",
				},
			},
		],
	],
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
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Check my ROSE staking rewards",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Pending rewards: 2.35 ROSE",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "How much have I earned from staking ROSE?",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Pending rewards: 1.87 ROSE",
				},
			},
		],
	],
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

			// Get the price per share to indicate how much rewards have accumulated
			const pricePerShare = await contractHelper.readContract({
				networkId: networkId,
				contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				method: "pricePerShare",
				args: [],
				abi: ABIS.WSTROSE,
			});

			// Get user's wstROSE balance
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
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Claim my ROSE staking rewards",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Successfully claimed rewards. Tx: 0x7b1a3c5e2d8f4b6d9e0c1d2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "I want to harvest my ROSE staking rewards",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Successfully claimed rewards. Tx: 0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
				},
			},
		],
	],
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
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "What staking strategies are available for ROSE?",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Available strategy: Accumulated Finance ROSE Staking",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Tell me about the staking options for ROSE",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Available strategy: Accumulated Finance ROSE Staking. This strategy allows you to stake ROSE tokens into the wstROSE ERC4626 vault to earn staking rewards with an estimated APY of 8-10% and no lockup period.",
				},
			},
		],
	],
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
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "How much ROSE do I have staked?",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Your staked balance is 150 ROSE",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Check my Accumulated Finance stake",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Your staked balance is 75.5 ROSE",
				},
			},
		],
	],
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
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Wrap 10 ROSE into wstROSE",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Wrap ROSE initiated. Tx: 0x3a8d706eed54b7b13f53e2a1639e0fff35ad5458c62af97d629b4bfcdb42e1a9",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Convert 25 ROSE to wrapped tokens",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Wrap ROSE initiated. Tx: 0x8c76a1137d31a3b7f5ccc29aa31f91436745e27d8865acc0cd4cdcb8ae34368f",
				},
			},
		],
	],
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
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Unwrap my wstROSE tokens",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unwrap ROSE initiated. Tx: 0x2d83f2c812a6d8d7707733782e13e767a79f24fbce0dbcd9d5115ffc8a9daed0",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Convert 5 wstROSE back to ROSE",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unwrap ROSE initiated. Tx: 0xc4e76828390784983d67594e6a256983c543f334a7bef7931f982ba55095551f",
				},
			},
		],
	],
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

export const mintAction: Action = {
	name: "ACCUMULATED_FINANCE_MINT",
	description:
		"Mint a specific number of wstROSE shares on Accumulated Finance",
	similes: ["MINT_WSTROSE_ACCUMULATED", "MINT_SHARES_ACCUMULATED"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "I want to mint 5 wstROSE shares",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Minted 5 wstROSE shares. Tx: 0x3a8d706eed54b7b13f53e2a1639e0fff35ad5458c62af97d629b4bfcdb42e1a9",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Mint 10 shares of wstROSE",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Minted 10 wstROSE shares. Tx: 0x8c76a1137d31a3b7f5ccc29aa31f91436745e27d8865acc0cd4cdcb8ae34368f",
				},
			},
		],
	],
	validate: async (runtime: IAgentRuntime) => {
		// Basic validation: Check if ContractHelper can be initialized
		try {
			elizaLogger.info("Validating mintAction: Creating ContractHelper");
			new ContractHelper(runtime);
			elizaLogger.info("Validation successful: ContractHelper created");
			return true;
		} catch (e) {
			elizaLogger.error(
				"Validation failed for mintAction: Coinbase/ContractHelper setup missing",
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
		elizaLogger.info("mintAction handler started", {
			options,
			runtimeDetails: {
				has_settings: !!runtime.getSetting,
			},
		});

		try {
			elizaLogger.info("Creating ContractHelper in mintAction handler");
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

			const sharesAmount = "5"; // Default to 1 share if not specified
			const receiver = "0xD952175d6A20187d7A5803DcC9741472F640A9b8";
			elizaLogger.info("Mint parameters", { sharesAmount, receiver });

			try {
				elizaLogger.info("Getting user address");
				const userAddress = await getUserAddressString(runtime, networkId);
				elizaLogger.info("User address retrieved", { userAddress });
				const targetReceiver = receiver || userAddress;

				// Get asset amount required for minting
				// const assetsRequired = await contractHelper.readContract({
				// 	networkId: networkId,
				// 	contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
				// 	method: "previewMint",
				// 	args: [sharesAmount],
				// 	abi: ABIS.WSTROSE,
				// });

				// // Approve
				// elizaLogger.info("Preparing to approve token spending", {
				// 	tokenContract: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
				// 	spender: networkConfig.CONTRACTS.WRAPPED_ROSE,
				// 	amount: sharesAmount.toString(),
				// });

				// try {
				// 	const approveResult = await contractHelper.invokeContract({
				// 		networkId: networkId,
				// 		contractAddress: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
				// 		method: "approve",
				// 		args: [
				// 			networkConfig.CONTRACTS.WRAPPED_ROSE,
				// 			sharesAmount.toString(),
				// 		],
				// 		abi: ABIS.WSTROSE,
				// 	});

				// 	elizaLogger.info("Approved token spending", {
				// 		status: approveResult.status,
				// 		details: approveResult,
				// 	});
				// } catch (approveError) {
				// 	elizaLogger.error("Failed to approve token spending", {
				// 		error:
				// 			approveError instanceof Error
				// 				? {
				// 						message: approveError.message,
				// 						stack: approveError.stack,
				// 						name: approveError.name,
				// 					}
				// 				: approveError,
				// 	});
				// 	throw approveError;
				// }

				// Deposit shares
				elizaLogger.info("Preparing to deposit shares", {
					contract: networkConfig.CONTRACTS.UNSTAKED_ROSE,
					shares: sharesAmount,
					receiver: targetReceiver,
				});

				try {
					const depositResult = await contractHelper.invokeContract({
						networkId: "23294", // Oasis Sapphire mainnet chain ID
						contractAddress: networkConfig.CONTRACTS.UNSTAKED_ROSE,
						method: "deposit",
						args: [targetReceiver],
						amount: sharesAmount,
						assetId: "wei", // Native token asset ID
						abi: ABIS.STROSE,
					});

					elizaLogger.info("Deposit completed", {
						status: depositResult.status,
						details: depositResult,
					});

					const result: StakingResult = {
						transactionHash:
							depositResult.transactionLink?.split("/").pop() || "",
						stakedAmount: sharesAmount.toString(),
						timestamp: Date.now(),
					};

					elizaLogger.info("Mint action completed successfully", result);

					if (callback)
						callback({
							text: `Minted ${sharesAmount} stROSE shares. Tx: ${result.transactionHash}`,
						});
					return result;
				} catch (mintError) {
					elizaLogger.error("Failed to mint shares", {
						error:
							mintError instanceof Error
								? {
										message: mintError.message,
										stack: mintError.stack,
										name: mintError.name,
									}
								: mintError,
					});
					throw mintError;
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
			elizaLogger.error("Mint action failed", {
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
				callback({ text: `Minting failed: ${error.message}` });
			} else if (callback) {
				callback({ text: "Minting failed: Unknown error" });
			}
			throw error;
		}
	},
};

export const approveAction: Action = {
	name: "ACCUMULATED_FINANCE_APPROVE",
	description: "Approve token spending for the Accumulated Finance contract",
	similes: ["APPROVE_TOKEN_SPENDING", "ALLOW_TOKEN_SPENDING"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Approve 50 ROSE to be spent by the wstROSE contract",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Approved 50 ROSE to be spent by the wstROSE contract. Tx: 0x3a8d706eed54b7b13f53e2a1639e0fff35ad5458c62af97d629b4bfcdb42e1a9",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "I want to authorize the Accumulated Finance contract to use my ROSE tokens",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Approved 100 ROSE to be spent by the wstROSE contract. Tx: 0x8c76a1137d31a3b7f5ccc29aa31f91436745e27d8865acc0cd4cdcb8ae34368f",
				},
			},
		],
	],
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
		elizaLogger.info("approveAction handler started", { options });

		try {
			const contractHelper = new ContractHelper(runtime);
			const { networkConfig, networkId } = getConfigAndNetwork(runtime);

			// Extract parameters
			const amount = options?.amount || "0";
			const spender = options?.spender || networkConfig.CONTRACTS.WRAPPED_ROSE;
			const token = options?.token || networkConfig.CONTRACTS.UNWRAPPED_ROSE;

			elizaLogger.info("Approval parameters", {
				token,
				spender,
				amount,
			});

			const result = await contractHelper.invokeContract({
				networkId: networkId,
				contractAddress: token,
				method: "approve",
				args: [spender, amount],
				abi: ABIS.ERC20,
			});

			const txReceipt: TransactionReceipt = {
				transactionHash: result.transactionLink?.split("/").pop() || "",
				status: result.status === "SUCCESS",
				blockNumber: 0,
				events: {},
			};

			if (callback) {
				// Create a human-readable message
				const tokenName =
					token === networkConfig.CONTRACTS.UNWRAPPED_ROSE ? "ROSE" : "token";
				const spenderName =
					spender === networkConfig.CONTRACTS.WRAPPED_ROSE
						? "wstROSE contract"
						: spender;
				callback({
					text: `Approved ${amount} ${tokenName} to be spent by the ${spenderName}. Tx: ${txReceipt.transactionHash}`,
				});
			}

			return txReceipt;
		} catch (error: unknown) {
			elizaLogger.error("Approval action failed", error);
			if (callback && error instanceof Error) {
				callback({ text: `Approval failed: ${error.message}` });
			} else if (callback) {
				callback({ text: `Approval failed: Unknown error` });
			}
			throw error;
		}
	},
};

export const redeemAction: Action = {
	name: "ACCUMULATED_FINANCE_REDEEM",
	description: "Redeem wstROSE shares to receive underlying ROSE tokens",
	similes: ["BURN_SHARES_ACCUMULATED", "EXCHANGE_SHARES_FOR_ROSE"],
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "I want to redeem 5 wstROSE shares for ROSE",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Redeemed 5 wstROSE shares for ROSE. Tx: 0x3a8d706eed54b7b13f53e2a1639e0fff35ad5458c62af97d629b4bfcdb42e1a9",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "Convert my wstROSE shares back to ROSE tokens",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Redeemed your wstROSE shares for ROSE. Tx: 0x8c76a1137d31a3b7f5ccc29aa31f91436745e27d8865acc0cd4cdcb8ae34368f",
				},
			},
		],
	],
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
		elizaLogger.info("redeemAction handler started", { options });

		try {
			const contractHelper = new ContractHelper(runtime);
			const { networkConfig, networkId } = getConfigAndNetwork(runtime);

			// Extract parameters
			const shares = options?.shares || "0";
			const receiver = options?.receiver;
			const owner = options?.owner;

			elizaLogger.info("Redeem parameters", { shares, receiver, owner });

			try {
				// Get addresses if not provided
				const userAddress = await getUserAddressString(runtime, networkId);
				const targetReceiver = receiver || userAddress;
				const shareOwner = owner || userAddress;

				// Call the redeem function on the contract
				const result = await contractHelper.invokeContract({
					networkId: networkId,
					contractAddress: networkConfig.CONTRACTS.WRAPPED_ROSE,
					method: "redeem",
					args: [shares, targetReceiver, shareOwner],
					abi: ABIS.WSTROSE,
				});

				elizaLogger.info("Redeem completed", {
					status: result.status,
					details: result,
				});

				const txReceipt: TransactionReceipt = {
					transactionHash: result.transactionLink?.split("/").pop() || "",
					status: result.status === "SUCCESS",
					blockNumber: 0,
					events: {},
				};

				if (callback)
					callback({
						text: `Redeemed ${shares} wstROSE shares for ROSE. Tx: ${txReceipt.transactionHash}`,
					});

				return txReceipt;
			} catch (error) {
				elizaLogger.error("Error in redeem operation", {
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
			elizaLogger.error("Redeem action failed", {
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
				callback({ text: `Failed to redeem shares: ${error.message}` });
			} else if (callback) {
				callback({ text: `Failed to redeem shares: Unknown error` });
			}
			throw error;
		}
	},
};
