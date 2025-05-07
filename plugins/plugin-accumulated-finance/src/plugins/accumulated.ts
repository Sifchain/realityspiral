import {
	type Action,
	type ActionExample,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type State,
	composeContext,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import * as ethers from "ethers";
import { ABIS, SAPPHIRE_MAINNET, SAPPHIRE_TESTNET } from "../constants";
import {
	approveTemplate,
	claimRewardsTemplate,
	getRewardsTemplate,
	getStakedBalanceTemplate,
	getStakingStrategiesTemplate,
	mintTemplate,
	redeemTemplate,
	stakeTemplate,
	unstakeTemplate,
	unwrapRoseTemplate,
	wrapRoseTemplate,
} from "../templates";
import {
	ApproveSchema,
	EmptySchema,
	MintSchema,
	type PluginConfig,
	PluginConfigSchema,
	RedeemSchema,
	type RewardInfo,
	StakeSchema,
	type StakingResult,
	type Strategy,
	type TransactionReceipt,
	UnstakeSchema,
	UnwrapRoseSchema,
	WrapRoseSchema,
	isApproveContent,
	isEmptyContent,
	isMintContent,
	isRedeemContent,
	isStakeContent,
	isUnstakeContent,
	isUnwrapRoseContent,
	isWrapRoseContent,
} from "../types";

import { getProviderAndSigner } from "../utils";

// Helper function to get user address from runtime
const getUserAddressString = async (
	runtime: IAgentRuntime,
	_networkId: string, // Network ID might not be needed if only getting address from settings
): Promise<string> => {
	try {
		// Get wallet address from runtime settings or signer
		const walletAddress = runtime.getSetting("WALLET_PUBLIC_KEY") as string;
		if (walletAddress) {
			elizaLogger.info("Retrieved wallet address from runtime settings", {
				walletAddress,
			});
			return walletAddress;
		}

		// Fallback: Get from signer if not in settings (requires network config)
		elizaLogger.warn(
			"WALLET_ADDRESS not found in settings, attempting to derive from signer.",
		);
		const tempConfig = getConfigAndNetwork(runtime);
		const { signer } = await getProviderAndSigner(
			runtime,
			tempConfig.networkConfig,
		);
		const derivedAddress = await signer.getAddress();
		elizaLogger.info("Derived wallet address from signer", { derivedAddress });
		if (!derivedAddress) {
			throw new Error(
				"Could not determine user address from settings or signer.",
			);
		}
		return derivedAddress;
	} catch (error: unknown) {
		elizaLogger.error(
			"Failed to get user address string",
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

// Helper function to convert decimal string amount to wei string
const convertToWeiString = (decimalAmount: string, decimals = 18): string => {
	try {
		// Handle potential empty string or invalid input before parsing
		if (
			!decimalAmount ||
			typeof decimalAmount !== "string" ||
			Number.isNaN(Number.parseFloat(decimalAmount))
		) {
			throw new Error(
				`Invalid input: "${decimalAmount}" is not a valid decimal number string.`,
			);
		}
		return ethers.parseUnits(decimalAmount, decimals).toString();
	} catch (e: unknown) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		elizaLogger.error("Failed to parse decimal amount to wei", {
			decimalAmount,
			decimals,
			error: errorMsg,
		});
		// Throw a more specific error for upstream handling
		throw new Error(
			`Invalid amount format: "${decimalAmount}". Could not convert to base units (${decimals} decimals). Reason: ${errorMsg}`,
		);
	}
};

// Helper function to get configuration and network details
const getConfigAndNetwork = (runtime: IAgentRuntime) => {
	const config: Partial<PluginConfig> = {
		network:
			(runtime.getSetting(
				"ACCUMULATED_FINANCE_NETWORK",
			) as PluginConfig["network"]) || "mainnet",
		// privateKey and walletSeed could also be sourced from settings if needed
	};
	const fullConfig = PluginConfigSchema.parse(config);
	const networkConfig =
		fullConfig.network === "mainnet" ? SAPPHIRE_MAINNET : SAPPHIRE_TESTNET;
	const networkId = fullConfig.network === "mainnet" ? "23294" : "23295";

	// Add warning for missing testnet addresses
	if (fullConfig.network === "testnet") {
		if (
			!networkConfig.CONTRACTS.WRAPPED_ROSE ||
			!networkConfig.CONTRACTS.UNWRAPPED_ROSE ||
			!networkConfig.CONTRACTS.UNSTAKED_ROSE // Added check for UNSTAKED_ROSE
		) {
			elizaLogger.warn(
				"Accumulated Finance Testnet configuration is missing contract addresses. Plugin may not function correctly.",
			);
		}
	}

	return { fullConfig, networkConfig, networkId };
};

/**
 * Implementation of the Accumulated Finance plugin for Oasis Sapphire
 */
export const accumulatedFinancePlugin = (
	runtime: IAgentRuntime,
	_pluginConfig: Partial<PluginConfig> = {},
) => {
	// Parse and validate configuration
	const { fullConfig, networkConfig, networkId } = getConfigAndNetwork(runtime);

	// Initialize Logging
	elizaLogger.info("Accumulated Finance plugin initializing...", {
		network: fullConfig.network,
		privacyLevel: fullConfig.privacyLevel,
		contractAddresses: {
			wrappedRose: networkConfig.CONTRACTS.WRAPPED_ROSE,
			unwrappedRose: networkConfig.CONTRACTS.UNWRAPPED_ROSE,
			unstakedRose: networkConfig.CONTRACTS.UNSTAKED_ROSE, // Added UNSTAKED_ROSE
		},
	});

	// ==================================
	// Internal Helper Functions
	// ==================================

	const _approve = async (
		tokenAddress: string,
		spenderAddress: string,
		amountDecimal: string,
	): Promise<ethers.TransactionReceipt | null> => {
		try {
			const amountWei = convertToWeiString(amountDecimal);
			elizaLogger.info("Internal approve helper", {
				tokenAddress,
				spenderAddress,
				amountDecimal,
				amountWei,
			});
			const { signer } = await getProviderAndSigner(runtime, networkConfig);
			const tokenContract = new ethers.Contract(
				tokenAddress,
				ABIS.ERC20,
				signer,
			);

			const approveTx = await tokenContract.approve(spenderAddress, amountWei, {
				gasLimit: 100000,
			});
			elizaLogger.info("Approval transaction sent", { hash: approveTx.hash });
			const approveReceipt = await approveTx.wait();
			elizaLogger.info("Approval transaction mined", {
				hash: approveReceipt?.hash,
				status: approveReceipt?.status,
			});
			return approveReceipt;
		} catch (error) {
			elizaLogger.error("Internal approve helper failed", { error });
			throw error; // Re-throw for higher level handling
		}
	};

	const _deposit = async (
		amountDecimal: string,
		receiver: string,
	): Promise<ethers.TransactionReceipt | null> => {
		try {
			const amountWei = convertToWeiString(amountDecimal);
			elizaLogger.info("Internal deposit helper", {
				amountDecimal,
				amountWei,
				receiver,
			});
			const { signer } = await getProviderAndSigner(runtime, networkConfig);
			const wrappedRoseContract = new ethers.Contract(
				networkConfig.CONTRACTS.WRAPPED_ROSE,
				ABIS.WSTROSE,
				signer,
			);

			// Ensure approval first
			await _approve(
				networkConfig.CONTRACTS.UNWRAPPED_ROSE,
				networkConfig.CONTRACTS.WRAPPED_ROSE,
				amountDecimal,
			);

			const depositTx = await wrappedRoseContract.deposit(amountWei, receiver, {
				gasLimit: 300000,
			});
			elizaLogger.info("Deposit transaction sent", { hash: depositTx.hash });
			const depositReceipt = await depositTx.wait();
			elizaLogger.info("Deposit transaction mined", {
				hash: depositReceipt?.hash,
				status: depositReceipt?.status,
			});
			return depositReceipt;
		} catch (error) {
			elizaLogger.error("Internal deposit helper failed", { error });
			throw error;
		}
	};

	const _withdraw = async (
		amount: string,
		receiver: string,
		owner: string,
	): Promise<ethers.TransactionReceipt | null> => {
		try {
			elizaLogger.info("Internal withdraw helper", { amount, receiver, owner });
			const { signer } = await getProviderAndSigner(runtime, networkConfig);
			const wrappedRoseContract = new ethers.Contract(
				networkConfig.CONTRACTS.WRAPPED_ROSE,
				ABIS.WSTROSE,
				signer,
			);
			const amountWei = convertToWeiString(amount);

			const withdrawTx = await wrappedRoseContract.withdraw(
				amountWei,
				receiver,
				owner,
				{ gasLimit: 300000 },
			);
			elizaLogger.info("Withdraw transaction sent", { hash: withdrawTx.hash });
			const withdrawReceipt = await withdrawTx.wait();
			elizaLogger.info("Withdraw transaction mined", {
				hash: withdrawReceipt?.hash,
				status: withdrawReceipt?.status,
			});
			return withdrawReceipt;
		} catch (error) {
			elizaLogger.error("Internal withdraw helper failed", { error });
			throw error;
		}
	};

	// Corrected internal mint logic TO USE DEPOSIT DIRECTLY
	const _mint = async (
		assetAmountDecimal: string, // Renamed: Takes asset amount (potentially decimal)
		receiver: string,
	): Promise<ethers.TransactionReceipt | null> => {
		try {
			elizaLogger.info("Internal mint helper (using deposit)", {
				assetAmountDecimal,
				receiver,
			});

			// Directly use the internal _deposit helper which handles conversion and approval.
			elizaLogger.info("Calling internal deposit helper for mint operation");
			const depositReceipt = await _deposit(assetAmountDecimal, receiver); // Pass decimal string

			elizaLogger.info("Mint (via deposit) transaction mined", {
				hash: depositReceipt?.hash,
				status: depositReceipt?.status,
			});
			return depositReceipt;
		} catch (error) {
			elizaLogger.error("Internal mint helper (using deposit) failed", {
				error,
			});
			throw error;
		}
	};

	const _redeem = async (
		shares: string,
		receiver: string,
		owner: string,
	): Promise<ethers.TransactionReceipt | null> => {
		try {
			elizaLogger.info("Internal redeem helper", { shares, receiver, owner });
			const { signer } = await getProviderAndSigner(runtime, networkConfig);
			const wrappedRoseContract = new ethers.Contract(
				networkConfig.CONTRACTS.WRAPPED_ROSE,
				ABIS.WSTROSE,
				signer,
			);

			const redeemTx = await wrappedRoseContract.redeem(
				shares,
				receiver,
				owner,
				{ gasLimit: 300000 },
			);
			elizaLogger.info("Redeem transaction sent", { hash: redeemTx.hash });
			const redeemReceipt = await redeemTx.wait();
			elizaLogger.info("Redeem transaction mined", {
				hash: redeemReceipt?.hash,
				status: redeemReceipt?.status,
			});
			return redeemReceipt;
		} catch (error) {
			elizaLogger.error("Internal redeem helper failed", { error });
			throw error;
		}
	};

	const _syncRewards = async (): Promise<ethers.TransactionReceipt | null> => {
		try {
			elizaLogger.info("Internal syncRewards helper");
			const { signer } = await getProviderAndSigner(runtime, networkConfig);
			const wrappedRoseContract = new ethers.Contract(
				networkConfig.CONTRACTS.WRAPPED_ROSE,
				ABIS.WSTROSE,
				signer,
			);

			const syncTx = await wrappedRoseContract.syncRewards({
				gasLimit: 200000,
			});
			elizaLogger.info("SyncRewards transaction sent", { hash: syncTx.hash });
			const syncReceipt = await syncTx.wait();
			elizaLogger.info("SyncRewards transaction mined", {
				hash: syncReceipt?.hash,
				status: syncReceipt?.status,
			});
			return syncReceipt;
		} catch (error) {
			elizaLogger.error("Internal syncRewards helper failed", { error });
			throw error;
		}
	};

	// ==================================
	// Public Plugin Functions
	// ==================================

	/**
	 * Stake ROSE tokens (ERC4626 deposit)
	 */
	const stake = async (
		amount: string,
		receiver?: string,
	): Promise<StakingResult> => {
		try {
			const targetReceiver =
				receiver || (await getUserAddressString(runtime, networkId));
			elizaLogger.info("Public stake function", { amount, targetReceiver });
			const receipt = await _deposit(amount, targetReceiver);

			if (!receipt || receipt.status !== 1) {
				throw new Error(
					`Staking transaction failed or reverted. Hash: ${receipt?.hash}`,
				);
			}

			const result: StakingResult = {
				transactionHash: receipt.hash,
				stakedAmount: amount,
				timestamp: Date.now(),
			};
			elizaLogger.info("Staking successful", result);
			return result;
		} catch (error: unknown) {
			const msg = "Staking failed";
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
			);
		}
	};

	/**
	 * Unstake ROSE tokens (ERC4626 withdraw)
	 */
	const unstake = async (
		amount: string,
		receiver?: string,
	): Promise<TransactionReceipt> => {
		try {
			const ownerAddress = await getUserAddressString(runtime, networkId);
			const targetReceiver = receiver || ownerAddress;
			elizaLogger.info("Public unstake function", {
				amount,
				targetReceiver,
				ownerAddress,
			});

			const receipt = await _withdraw(amount, targetReceiver, ownerAddress);

			if (!receipt || receipt.status !== 1) {
				throw new Error(
					`Unstaking transaction failed or reverted. Hash: ${receipt?.hash}`,
				);
			}

			const txReceipt: TransactionReceipt = {
				transactionHash: receipt.hash,
				status: true,
				blockNumber: receipt.blockNumber,
				events: {}, // Could parse logs if needed
			};
			elizaLogger.info("Unstaking successful", txReceipt);
			return txReceipt;
		} catch (error: unknown) {
			const msg = "Unstaking failed";
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
			);
		}
	};

	/**
	 * Get staking rewards information
	 */
	const getRewards = async (): Promise<RewardInfo> => {
		try {
			const ownerAddress = await getUserAddressString(runtime, networkId);
			elizaLogger.info("Public getRewards function", { ownerAddress });
			const { provider } = await getProviderAndSigner(runtime, networkConfig);
			const wrappedRoseContract = new ethers.Contract(
				networkConfig.CONTRACTS.WRAPPED_ROSE,
				ABIS.WSTROSE,
				provider,
			);

			const [pricePerShare, shares] = await Promise.all([
				wrappedRoseContract.pricePerShare(),
				wrappedRoseContract.balanceOf(ownerAddress),
			]);

			const sharesBigInt = BigInt(shares);
			const pricePerShareBigInt = BigInt(pricePerShare);
			const scaleFactor = BigInt(10 ** 18);

			const currentValue = (sharesBigInt * pricePerShareBigInt) / scaleFactor;
			const originalValue = sharesBigInt; // Simplification: Assumes shares were minted/deposited at 1:1 initially

			const pendingRewards =
				currentValue > originalValue
					? (currentValue - originalValue).toString()
					: "0";

			const rewardInfo: RewardInfo = {
				pendingRewards: pendingRewards,
				claimedRewards: "0", // This vault likely doesn't track claimed separately
				lastClaimTimestamp: Date.now(), // Not meaningful here
			};
			elizaLogger.info("Rewards info calculated", rewardInfo);
			return rewardInfo;
		} catch (error: unknown) {
			const msg = "Failed to get rewards";
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
			);
		}
	};

	/**
	 * Claim staking rewards (syncs rewards)
	 */
	const claimRewards = async (): Promise<TransactionReceipt> => {
		try {
			elizaLogger.info("Public claimRewards function (syncing)");
			const receipt = await _syncRewards();

			if (!receipt || receipt.status !== 1) {
				throw new Error(
					`Claim (sync) transaction failed or reverted. Hash: ${receipt?.hash}`,
				);
			}

			const txReceipt: TransactionReceipt = {
				transactionHash: receipt.hash,
				status: true,
				blockNumber: receipt.blockNumber,
				events: {},
			};
			elizaLogger.info("Claim (sync) successful", txReceipt);
			return txReceipt;
		} catch (error: unknown) {
			const msg = "Failed to claim rewards (sync)";
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
			);
		}
	};

	/**
	 * Get available staking strategies
	 */
	const getStakingStrategies = async (): Promise<Strategy[]> => {
		elizaLogger.info("Public getStakingStrategies function");
		// Only one strategy currently supported by this contract implementation
		return [
			{
				id: "default-wstROSE",
				name: "Accumulated Finance wstROSE Vault",
				description:
					"Stake ROSE tokens into the wstROSE ERC4626 vault to earn staking rewards.",
				riskLevel: "low",
				estimatedApy: "~8-10%", // Example, fetch dynamically if possible
				lockupPeriod: "None",
			},
		];
	};

	/**
	 * Get staked balance (in underlying ROSE)
	 */
	const getStakedBalance = async (): Promise<string> => {
		try {
			const userAddress = await getUserAddressString(runtime, networkId);
			elizaLogger.info("Public getStakedBalance function", { userAddress });
			const { provider } = await getProviderAndSigner(runtime, networkConfig);
			const wrappedRoseContract = new ethers.Contract(
				networkConfig.CONTRACTS.WRAPPED_ROSE,
				ABIS.WSTROSE,
				provider,
			);

			const wstRoseBalance = await wrappedRoseContract.balanceOf(userAddress);
			const roseAmount =
				await wrappedRoseContract.convertToAssets(wstRoseBalance);

			const balanceString = roseAmount.toString();
			elizaLogger.info("Staked balance retrieved", { balanceString });
			return balanceString;
		} catch (error: unknown) {
			const msg = "Failed to get staked balance";
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
			);
		}
	};

	/**
	 * Wrap native ROSE tokens to wROSE (equivalent to staking)
	 */
	const wrapRose = async (amount: string): Promise<TransactionReceipt> => {
		try {
			elizaLogger.info("Public wrapRose function", { amount });
			const stakeResult = await stake(amount); // Reuses the public stake logic

			// Adapt the StakingResult to TransactionReceipt format
			const txReceipt: TransactionReceipt = {
				transactionHash: stakeResult.transactionHash,
				status: !!stakeResult.transactionHash,
				blockNumber: 0, // Block number not available from stakeResult easily
				events: {},
			};
			elizaLogger.info("Wrapping successful", txReceipt);
			return txReceipt;
		} catch (error: unknown) {
			const msg = "Failed to wrap ROSE";
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
			);
		}
	};

	/**
	 * Unwrap wROSE to native ROSE tokens (equivalent to unstaking)
	 */
	const unwrapRose = async (amount: string): Promise<TransactionReceipt> => {
		try {
			elizaLogger.info("Public unwrapRose function", { amount });
			// This needs the amount of *wstROSE* to unwrap, not underlying ROSE.
			// Let's assume the user means the amount of *underlying* ROSE to receive.
			// We need to convert this asset amount to shares first.
			const { signer } = await getProviderAndSigner(runtime, networkConfig);
			const wrappedRoseContract = new ethers.Contract(
				networkConfig.CONTRACTS.WRAPPED_ROSE,
				ABIS.WSTROSE,
				signer,
			);

			const sharesToRedeem = await wrappedRoseContract.convertToShares(amount);
			elizaLogger.info("Calculated shares to redeem for unwrap", {
				sharesToRedeem: sharesToRedeem.toString(),
			});

			const ownerAddress = await getUserAddressString(runtime, networkId);
			const targetReceiver = ownerAddress; // Unwrap usually sends to owner

			// Use redeem with the calculated shares
			const receipt = await _redeem(
				sharesToRedeem.toString(),
				targetReceiver,
				ownerAddress,
			);

			if (!receipt || receipt.status !== 1) {
				throw new Error(
					`Unwrapping (redeem) transaction failed or reverted. Hash: ${receipt?.hash}`,
				);
			}

			const txReceipt: TransactionReceipt = {
				transactionHash: receipt.hash,
				status: true,
				blockNumber: receipt.blockNumber,
				events: {},
			};
			elizaLogger.info("Unwrapping successful", txReceipt);
			return txReceipt;
		} catch (error: unknown) {
			const msg = "Failed to unwrap ROSE";
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
			);
		}
	};

	/**
	 * Mint wstROSE by depositing underlying ROSE (ERC4626 deposit)
	 * Note: This now mirrors the 'stake' function due to using _deposit internally.
	 */
	const mint = async (
		assetAmountDecimal: string, // Changed from sharesAmount
		receiver?: string,
	): Promise<StakingResult> => {
		// Return type needs care
		try {
			const targetReceiver =
				receiver || (await getUserAddressString(runtime, networkId));
			elizaLogger.info("Public mint function (depositing assets)", {
				// Updated log
				assetAmountDecimal, // Log decimal amount
				targetReceiver,
			});

			// Call the internal _mint which now just calls _deposit
			const receipt = await _mint(assetAmountDecimal, targetReceiver);

			if (!receipt || receipt.status !== 1) {
				throw new Error(
					`Minting (deposit) transaction failed or reverted. Hash: ${receipt?.hash}`, // Updated msg
				);
			}

			// StakingResult expects stakedAmount. Since we deposited assets,
			// the amount deposited is the asset amount in wei.
			// Convert the input decimal string to wei for the result.
			const amountWei = convertToWeiString(assetAmountDecimal);

			const result: StakingResult = {
				transactionHash: receipt.hash,
				stakedAmount: amountWei, // Store amount in wei
				timestamp: Date.now(),
			};
			elizaLogger.info("Minting (deposit) successful", result);
			return result;
		} catch (error: unknown) {
			const msg = "Minting (deposit) failed"; // Updated msg
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
			);
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
			elizaLogger.info("Public approve function", {
				tokenAddress,
				spenderAddress,
				amount,
			});
			const receipt = await _approve(tokenAddress, spenderAddress, amount);

			if (!receipt || receipt.status !== 1) {
				throw new Error(
					`Approval transaction failed or reverted. Hash: ${receipt?.hash}`,
				);
			}

			const txReceipt: TransactionReceipt = {
				transactionHash: receipt.hash,
				status: true,
				blockNumber: receipt.blockNumber,
				events: {},
			};
			elizaLogger.info("Approval successful", txReceipt);
			return txReceipt;
		} catch (error: unknown) {
			const msg = "Approval failed";
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
			);
		}
	};

	/**
	 * Redeem a specific number of shares for underlying assets (ERC4626 redeem)
	 */
	const redeem = async (
		shares: string,
		receiver?: string,
		owner?: string,
	): Promise<TransactionReceipt> => {
		try {
			const ownerAddress =
				owner || (await getUserAddressString(runtime, networkId));
			const targetReceiver = receiver || ownerAddress;
			elizaLogger.info("Public redeem function", {
				shares,
				targetReceiver,
				ownerAddress,
			});

			const receipt = await _redeem(shares, targetReceiver, ownerAddress);

			if (!receipt || receipt.status !== 1) {
				throw new Error(
					`Redeem transaction failed or reverted. Hash: ${receipt?.hash}`,
				);
			}

			const txReceipt: TransactionReceipt = {
				transactionHash: receipt.hash,
				status: true,
				blockNumber: receipt.blockNumber,
				events: {},
			};
			elizaLogger.info("Redeeming successful", txReceipt);
			return txReceipt;
		} catch (error: unknown) {
			const msg = "Failed to redeem shares";
			elizaLogger.error(msg, { error });
			throw new Error(
				`${msg}: ${error instanceof Error ? error.message : "Unknown reason"}`,
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
		mint,
		approve,
		redeem,

		// Add explicit standard ERC4626 naming aliases
		deposit: stake,
		withdraw: unstake,
	};
};

// --- Action Definitions --- //

// Helper to create context for generateObject
const createActionContext = (state: State | undefined, template: string) => {
	return state
		? composeContext({ state, template })
		: template.replace("{{recentMessages}}", "");
};

// Stake Action
export const stakeAction: Action = {
	name: "ACCUMULATED_FINANCE_STAKE",
	description: "Stake ROSE tokens on Accumulated Finance",
	similes: ["STAKE_ON_ACCUMULATED", "DEPOSIT_ROSE_ACCUMULATED"],
	examples: [
		[
			{
				user: "{{user}}",
				content: { text: "I want to stake 10 ROSE on Accumulated Finance" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Staked 10 ROSE. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_STAKE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Stake 5.5 ROSE to earn rewards" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Staked 5.5 ROSE. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_STAKE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Deposit 0.05 ROSE to Accumulated Finance" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Staked 0.05 ROSE. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_STAKE",
				},
			},
		],
	],
	validate: async (runtime: IAgentRuntime) => {
		try {
			const pk =
				runtime.getSetting("WALLET_PRIVATE_KEY") ||
				process.env.WALLET_PRIVATE_KEY;
			return !!pk;
		} catch {
			return false;
		}
	},
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<StakingResult> => {
		elizaLogger.info("stakeAction handler started");
		try {
			const context = createActionContext(state, stakeTemplate);
			const stakeDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: StakeSchema,
			});

			if (!isStakeContent(stakeDetails.object)) {
				throw new Error("Invalid stake details extracted.");
			}

			const plugin = accumulatedFinancePlugin(runtime);
			const result = await plugin.stake(
				stakeDetails.object.amount,
				stakeDetails.object.receiver,
			);

			if (callback) {
				callback({
					text: `Staked ${result.stakedAmount} ROSE. Tx: ${result.transactionHash}`,
				});
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Stake action failed", { error });
			if (callback) {
				callback({
					text: `Staking failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Unstake Action
export const unstakeAction: Action = {
	name: "ACCUMULATED_FINANCE_UNSTAKE",
	description: "Unstake ROSE tokens from Accumulated Finance",
	similes: ["UNSTAKE_FROM_ACCUMULATED", "WITHDRAW_ROSE_ACCUMULATED"],
	examples: [
		[
			{
				user: "{{user}}",
				content: { text: "I want to unstake 10 ROSE from Accumulated Finance" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unstake initiated for 10 ROSE. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_UNSTAKE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Withdraw 5 ROSE from my stake" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unstake initiated for 5 ROSE. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_UNSTAKE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Remove 2.5 ROSE from Accumulated Finance staking" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unstake initiated for 2.5 ROSE. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_UNSTAKE",
				},
			},
		],
	],
	validate: stakeAction.validate, // Same validation as stake
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<TransactionReceipt> => {
		elizaLogger.info("unstakeAction handler started");
		try {
			const context = createActionContext(state, unstakeTemplate);
			const unstakeDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: UnstakeSchema,
			});

			if (!isUnstakeContent(unstakeDetails.object)) {
				throw new Error("Invalid unstake details extracted.");
			}

			const plugin = accumulatedFinancePlugin(runtime);
			const result = await plugin.unstake(
				unstakeDetails.object.amount,
				unstakeDetails.object.receiver,
			);

			if (callback) {
				callback({
					text: `Unstake initiated for ${unstakeDetails.object.amount} ROSE. Tx: ${result.transactionHash}`,
				});
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Unstake action failed", { error });
			if (callback) {
				callback({
					text: `Unstaking failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Get Rewards Action
export const getRewardsAction: Action = {
	name: "ACCUMULATED_FINANCE_GET_REWARDS",
	description: "Get accumulated staking rewards from Accumulated Finance",
	similes: ["CHECK_ACCUMULATED_REWARDS"],
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "How much reward have I earned on Accumulated Finance?",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Pending rewards: 0.25 ROSE",
					action: "ACCUMULATED_FINANCE_GET_REWARDS",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Check my staking rewards" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Pending rewards: 1.5 ROSE",
					action: "ACCUMULATED_FINANCE_GET_REWARDS",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "What are my current accumulated rewards?" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Pending rewards: 0.05 ROSE",
					action: "ACCUMULATED_FINANCE_GET_REWARDS",
				},
			},
		],
	],
	validate: stakeAction.validate, // Requires wallet info to read balance
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<RewardInfo> => {
		elizaLogger.info("getRewardsAction handler started");
		try {
			const context = createActionContext(state, getRewardsTemplate);
			const details = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: EmptySchema,
			});

			if (!isEmptyContent(details.object)) {
				// Even if empty schema, good practice to check
				throw new Error("Invalid get rewards request.");
			}

			const plugin = accumulatedFinancePlugin(runtime);
			const result = await plugin.getRewards();

			if (callback) {
				callback({ text: `Pending rewards: ${result.pendingRewards} ROSE` });
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Get rewards action failed", { error });
			if (callback) {
				callback({
					text: `Failed to get rewards: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Claim Rewards Action
export const claimRewardsAction: Action = {
	name: "ACCUMULATED_FINANCE_CLAIM_REWARDS",
	description: "Claim staking rewards from Accumulated Finance (syncs rewards)",
	similes: ["CLAIM_ACCUMULATED_REWARDS", "SYNC_ACCUMULATED_REWARDS"],
	examples: [
		[
			{
				user: "{{user}}",
				content: { text: "Claim my staking rewards from Accumulated Finance" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Successfully claimed rewards (synced). Tx: 0x...",
					action: "ACCUMULATED_FINANCE_CLAIM_REWARDS",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Sync my Accumulated Finance rewards" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Successfully claimed rewards (synced). Tx: 0x...",
					action: "ACCUMULATED_FINANCE_CLAIM_REWARDS",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "I'd like to claim my staking yield" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Successfully claimed rewards (synced). Tx: 0x...",
					action: "ACCUMULATED_FINANCE_CLAIM_REWARDS",
				},
			},
		],
	],
	validate: stakeAction.validate, // Requires signer
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<TransactionReceipt> => {
		elizaLogger.info("claimRewardsAction handler started");
		try {
			const context = createActionContext(state, claimRewardsTemplate);
			const details = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: EmptySchema,
			});

			if (!isEmptyContent(details.object)) {
				throw new Error("Invalid claim rewards request.");
			}

			const plugin = accumulatedFinancePlugin(runtime);
			const result = await plugin.claimRewards();

			if (callback) {
				callback({
					text: `Successfully claimed rewards (synced). Tx: ${result.transactionHash}`,
				});
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Claim rewards action failed", { error });
			if (callback) {
				callback({
					text: `Failed to claim rewards: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Get Staking Strategies Action
export const getStakingStrategiesAction: Action = {
	name: "ACCUMULATED_FINANCE_GET_STRATEGIES",
	description: "Get available staking strategies for Accumulated Finance",
	similes: ["LIST_ACCUMULATED_STRATEGIES"],
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "What staking strategies are available on Accumulated Finance?",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Available strategy: Accumulated Finance wstROSE Vault",
					action: "ACCUMULATED_FINANCE_GET_STRATEGIES",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Show me the staking options for ROSE" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Available strategy: Accumulated Finance wstROSE Vault",
					action: "ACCUMULATED_FINANCE_GET_STRATEGIES",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "List Accumulated Finance strategies" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Available strategy: Accumulated Finance wstROSE Vault",
					action: "ACCUMULATED_FINANCE_GET_STRATEGIES",
				},
			},
		],
	],
	validate: async () => true, // No specific validation needed
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<Strategy[]> => {
		elizaLogger.info("getStakingStrategiesAction handler started");
		try {
			const context = createActionContext(state, getStakingStrategiesTemplate);
			const details = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: EmptySchema,
			});

			if (!isEmptyContent(details.object)) {
				throw new Error("Invalid get strategies request.");
			}

			const plugin = accumulatedFinancePlugin(runtime);
			const result = await plugin.getStakingStrategies();

			if (callback && result.length > 0) {
				callback({ text: `Available strategy: ${result[0].name}` });
			} else if (callback) {
				callback({ text: "No staking strategies found." });
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Get strategies action failed", { error });
			if (callback) {
				callback({
					text: `Failed to get strategies: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Get Staked Balance Action
export const getStakedBalanceAction: Action = {
	name: "ACCUMULATED_FINANCE_GET_STAKED_BALANCE",
	description: "Get the staked ROSE balance from Accumulated Finance",
	similes: ["CHECK_ACCUMULATED_BALANCE"],
	examples: [
		[
			{
				user: "{{user}}",
				content: { text: "What's my staked balance on Accumulated Finance?" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Your staked balance is 25.5 ROSE",
					action: "ACCUMULATED_FINANCE_GET_STAKED_BALANCE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "How much ROSE do I have staked?" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Your staked balance is 10 ROSE",
					action: "ACCUMULATED_FINANCE_GET_STAKED_BALANCE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Check my staked ROSE balance" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Your staked balance is 5.25 ROSE",
					action: "ACCUMULATED_FINANCE_GET_STAKED_BALANCE",
				},
			},
		],
	],
	validate: stakeAction.validate, // Requires wallet info
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<string> => {
		elizaLogger.info("getStakedBalanceAction handler started");
		try {
			const context = createActionContext(state, getStakedBalanceTemplate);
			const details = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: EmptySchema,
			});

			if (!isEmptyContent(details.object)) {
				throw new Error("Invalid get staked balance request.");
			}

			const plugin = accumulatedFinancePlugin(runtime);
			const result = await plugin.getStakedBalance();

			if (callback) {
				callback({ text: `Your staked balance is ${result} ROSE` });
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Get staked balance action failed", { error });
			if (callback) {
				callback({
					text: `Failed to get staked balance: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Wrap Rose Action
export const wrapRoseAction: Action = {
	name: "ACCUMULATED_FINANCE_WRAP_ROSE",
	description: "Wrap native ROSE into wstROSE (equivalent to staking)",
	similes: ["WRAP_ROSE_ACCUMULATED"],
	examples: [
		[
			{
				user: "{{user}}",
				content: { text: "Wrap 10 ROSE to wstROSE" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Wrap ROSE initiated. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_WRAP_ROSE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Convert 5 ROSE to wrapped tokens" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Wrap ROSE initiated. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_WRAP_ROSE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "I want to wrap 0.05 ROSE" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Wrap ROSE initiated. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_WRAP_ROSE",
				},
			},
		],
	],
	validate: stakeAction.validate, // Same as staking
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<TransactionReceipt> => {
		elizaLogger.info("wrapRoseAction handler started");
		try {
			const context = createActionContext(state, wrapRoseTemplate);
			const wrapDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: WrapRoseSchema,
			});

			if (!isWrapRoseContent(wrapDetails.object)) {
				throw new Error("Invalid wrap ROSE details extracted.");
			}

			const plugin = accumulatedFinancePlugin(runtime);
			const result = await plugin.wrapRose(wrapDetails.object.amount);

			if (callback) {
				callback({
					text: `Wrap ROSE initiated. Tx: ${result.transactionHash}`,
				});
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Wrap ROSE action failed", { error });
			if (callback) {
				callback({
					text: `Failed to wrap ROSE: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Unwrap Rose Action
export const unwrapRoseAction: Action = {
	name: "ACCUMULATED_FINANCE_UNWRAP_ROSE",
	description: "Unwrap wstROSE into native ROSE (equivalent to unstaking)",
	similes: ["UNWRAP_ROSE_ACCUMULATED", "UNSTAKE_ROSE"],
	examples: [
		[
			{
				user: "{{user}}",
				content: { text: "Unwrap 10 wstROSE to ROSE" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unwrap wstROSE initiated. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_UNWRAP_ROSE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Convert 5 wstROSE back to ROSE" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unwrap wstROSE initiated. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_UNWRAP_ROSE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "I want to unwrap 0.05 wstROSE" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Unwrap wstROSE initiated. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_UNWRAP_ROSE",
				},
			},
		],
	],
	validate: unstakeAction.validate, // Same as unstaking
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<TransactionReceipt> => {
		elizaLogger.info("unwrapRoseAction handler started");
		try {
			const context = createActionContext(state, unwrapRoseTemplate);
			const unwrapDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: UnwrapRoseSchema,
			});

			if (!isUnwrapRoseContent(unwrapDetails.object)) {
				throw new Error("Invalid unwrap ROSE details extracted.");
			}

			const plugin = accumulatedFinancePlugin(runtime);
			const result = await plugin.unwrapRose(unwrapDetails.object.amount);

			if (callback) {
				callback({
					text: `Unwrap wstROSE initiated. Tx: ${result.transactionHash}`,
				});
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Unwrap ROSE action failed", { error });
			if (callback) {
				callback({
					text: `Failed to unwrap ROSE: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Mint Action
export const mintAction: Action = {
	name: "ACCUMULATED_FINANCE_MINT",
	description: "Mint wstROSE by depositing underlying ROSE tokens",
	similes: ["MINT_STROSE_ACCUMULATED", "DEPOSIT_ROSE_FOR_WSTROSE"],
	examples: [
		[
			{ user: "{{user}}", content: { text: "Mint 10 ROSE worth of wstROSE" } },
			{
				user: "{{agentName}}",
				content: {
					text: "Minted wstROSE by depositing 10 ROSE. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_MINT",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Deposit 5.5 ROSE into the wstROSE vault via mint action",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Minted wstROSE by depositing 5.5 ROSE. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_MINT",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Use the mint action to deposit 0.05 ROSE" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Minted wstROSE by depositing 0.05 ROSE. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_MINT",
				},
			},
		],
	],
	validate: stakeAction.validate, // Requires signer
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<StakingResult> => {
		elizaLogger.info("mintAction handler started");
		try {
			const context = createActionContext(state, mintTemplate);
			const mintDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: MintSchema,
			});

			if (
				!mintDetails ||
				typeof mintDetails.object !== "object" ||
				mintDetails.object === null
			) {
				// Safety check for generateObject result
				elizaLogger.error(
					"Mint action: Failed to extract details object from generateObject",
				);
				throw new Error("Failed to extract mint details.");
			}

			if (
				"receiver" in mintDetails.object &&
				typeof mintDetails.object.receiver === "string" &&
				mintDetails.object.receiver.toLowerCase() === "null"
			) {
				// Refine the user's check to address potential type issues and linter errors
				// Note: The purpose of mapping "null" string to a hardcoded address is unclear.
				// Check if receiver exists and is the string "null"
				elizaLogger.warn(
					"Mint action: receiver input was 'null', overriding with hardcoded address.",
				);
				// We need to ensure mintDetails.object is not read-only if we modify it.
				// Assuming MintSchema produces a mutable object.
				(mintDetails.object as { receiver?: string }).receiver =
					"0xD952175d6A20187d7A5803DcC9741472F640A9b8";
			}

			if (!isMintContent(mintDetails.object)) {
				// isMintContent checks if object matches MintSchema
				elizaLogger.error(
					"Mint action: Extracted details do not match MintSchema",
					{ details: mintDetails.object },
				);
				throw new Error("Invalid mint details extracted after generation.");
			}
			// Now mintDetails.object should conform to MintContent type

			const assetAmountDecimal = mintDetails.object.amount; // This is the potentially decimal string e.g., "0.05"
			const receiver = mintDetails.object.receiver; // Can be undefined if optional in schema

			const plugin = accumulatedFinancePlugin(runtime);
			// Call the updated plugin.mint which expects asset amount
			const result = await plugin.mint(
				assetAmountDecimal,
				receiver, // Pass receiver (might be undefined, plugin handles default)
			);

			if (callback) {
				// Use the input decimal amount for the message, as it's more user-friendly
				callback({
					text: `Minted wstROSE by depositing ${assetAmountDecimal} ROSE. Tx: ${result.transactionHash}`, // Updated message
				});
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Mint action failed", { error });
			if (callback) {
				callback({
					text: `Minting failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Approve Action
export const approveAction: Action = {
	name: "ACCUMULATED_FINANCE_APPROVE",
	description: "Approve token spending for the Accumulated Finance contract",
	similes: ["APPROVE_TOKEN_SPENDING", "ALLOW_TOKEN_SPENDING"],
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "I need to approve the wstROSE vault to spend 100 of my ROSE tokens.",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Approved 100 ROSE for wstROSE vault. Tx: 0x...",
					action: "ACCUMULATED_FINANCE_APPROVE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: { text: "Allow the vault (0x...) to spend 50.5 ROSE (0x...)" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Approved 50.5 ROSE for spender (0x...). Tx: 0x...",
					action: "ACCUMULATED_FINANCE_APPROVE",
				},
			},
		],
	],
	validate: stakeAction.validate, // Requires signer
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	): Promise<TransactionReceipt> => {
		elizaLogger.info("approveAction handler started");
		try {
			const context = createActionContext(state, approveTemplate);
			const approveDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: ApproveSchema,
			});

			if (!isApproveContent(approveDetails.object)) {
				throw new Error("Invalid approve details extracted.");
			}

			const plugin = accumulatedFinancePlugin(runtime);
			const result = await plugin.approve(
				approveDetails.object.tokenAddress,
				approveDetails.object.spenderAddress,
				approveDetails.object.amount,
			);

			if (callback) {
				const { tokenAddress, spenderAddress, amount } = approveDetails.object;
				// Provide clearer feedback based on known contracts if possible
				const { networkConfig } = getConfigAndNetwork(runtime);
				const tokenName =
					tokenAddress === networkConfig.CONTRACTS.UNWRAPPED_ROSE
						? "ROSE"
						: `token (${tokenAddress.substring(0, 6)}...)`;
				const spenderName =
					spenderAddress === networkConfig.CONTRACTS.WRAPPED_ROSE
						? "wstROSE vault"
						: `spender (${spenderAddress.substring(0, 6)}...)`;

				callback({
					text: `Approved ${amount} ${tokenName} for ${spenderName}. Tx: ${result.transactionHash}`,
				});
			}
			return result;
		} catch (error: unknown) {
			elizaLogger.error("Approve action failed", { error });
			if (callback) {
				callback({
					text: `Approval failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
			throw error;
		}
	},
};

// Redeem Action
// export const redeemAction: Action = {
// 	name: "ACCUMULATED_FINANCE_REDEEM",
// 	description:
// 		"Redeem wstROSE shares to receive a specific amount of underlying ROSE tokens",
// 	similes: [
// 		"REDEEM_SHARES_FOR_ROSE",
// 		"BURN_SHARES_TO_GET_ROSE",
// 		"EXCHANGE_SHARES_FOR_ROSE",
// 	],
// 	examples: [
// 		[
// 			{
// 				user: "{{user}}",
// 				content: { text: "Redeem shares equivalent to 10 ROSE." },
// 			},
// 			{
// 				user: "{{agentName}}",
// 				content: {
// 					text: "Redeemed 50 wstROSE shares. Tx: 0x...",
// 					action: "ACCUMULATED_FINANCE_REDEEM",
// 				},
// 			},
// 		],
// 		[
// 			{
// 				user: "{{user}}",
// 				content: {
// 					text: "I want to get 0.05 ROSE back by redeeming my wstROSE.",
// 				},
// 			},
// 			{
// 				user: "{{agentName}}",
// 				content: {
// 					text: "Redeemed shares for 0.05 ROSE. Tx: 0x...",
// 					action: "ACCUMULATED_FINANCE_REDEEM",
// 				},
// 			},
// 		],
// 	],
// 	validate: stakeAction.validate, // Requires signer
// 	handler: async (
// 		runtime: IAgentRuntime,
// 		_message: Memory,
// 		state?: State,
// 		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
// 		_options?: any,
// 		callback?: HandlerCallback,
// 	): Promise<TransactionReceipt> => {
// 		elizaLogger.info("redeemAction handler started");
// 		try {
// 			const context = createActionContext(state, redeemTemplate);
// 			const redeemDetails = await generateObject({
// 				runtime,
// 				context,
// 				modelClass: ModelClass.SMALL,
// 				schema: RedeemSchema,
// 			});

// 			// Safety check for generateObject result
// 			if (
// 				!redeemDetails ||
// 				typeof redeemDetails.object !== "object" ||
// 				redeemDetails.object === null
// 			) {
// 				elizaLogger.error(
// 					"Redeem action: Failed to extract details object from generateObject",
// 				);
// 				throw new Error("Failed to extract redeem details.");
// 			}

// 			// Add specific checks if receiver/owner can be "null" string like in mint
// 			// ... (similar logic as mintAction if needed)
// 			redeemDetails.object.owner = process.env.WALLET_PUBLIC_KEY;

// 			// *** IMPORTANT: Adapt isRedeemContent check if schema changed ***
// 			if (!isRedeemContent(redeemDetails.object)) {
// 				elizaLogger.error(
// 					"Redeem action: Extracted details do not match RedeemSchema (expected assetAmountDecimal)",
// 					{ details: redeemDetails.object },
// 				);
// 				throw new Error(
// 					"Invalid redeem details extracted (expected asset amount).",
// 				);
// 			}

// 			const {
// 				shares: assetAmountDecimal,
// 				receiver,
// 				owner,
// 			} = redeemDetails.object;

// 			elizaLogger.log("Receiver ", receiver, "owner", owner);

// 			// Get plugin instance *before* potential pre-deposit
// 			const plugin = accumulatedFinancePlugin(runtime);

// 			// Get provider/signer to interact with contract for conversion
// 			const { networkConfig } = getConfigAndNetwork(runtime); // Get network config
// 			const { provider } = await getProviderAndSigner(runtime, networkConfig); // Get provider
// 			const wrappedRoseContractView = new ethers.Contract(
// 				// Instantiate with provider for view call
// 				networkConfig.CONTRACTS.WRAPPED_ROSE, // Use WRAPPED_ROSE for conversion
// 				ABIS.WSTROSE,
// 				provider, // Use provider
// 			);

// 			// Convert the asset amount to wei first, as convertToShares likely expects uint input via ethers
// 			const assetAmountWei = convertToWeiString(assetAmountDecimal);
// 			elizaLogger.info("Converted asset amount to wei for convertToShares", {
// 				assetAmountDecimal,
// 				assetAmountWei,
// 			});

// 			const sharesToRedeemBigInt =
// 				await wrappedRoseContractView.convertToShares(assetAmountWei); // Call on provider instance
// 			const sharesToRedeem = sharesToRedeemBigInt.toString(); // Convert BigInt result to string for plugin call
// 			elizaLogger.info("Calculated shares to redeem", {
// 				assetAmountDecimal,
// 				sharesToRedeem,
// 			});
// 			// --- End of added logic ---

// 			// Call plugin.redeem with the calculated shares string
// 			const result = await plugin.redeem(
// 				sharesToRedeem, // Use calculated shares
// 				receiver, // Pass through receiver and owner
// 				owner,
// 			);

// 			if (callback) {
// 				// Report back based on the requested asset amount
// 				callback({
// 					text: `Redeemed shares for ${assetAmountDecimal} ROSE. Tx: ${result.transactionHash}`,
// 				});
// 			}
// 			return result;
// 		} catch (error: unknown) {
// 			elizaLogger.error("Redeem action failed", { error });
// 			if (callback) {
// 				callback({
// 					text: `Failed to redeem shares: ${error instanceof Error ? error.message : "Unknown error"}`,
// 				});
// 			}
// 			throw error;
// 		}
// 	},
// };
