import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import axios from "axios";
import { Contract, type Signer } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { formatUnits } from "ethers/utils";

// prosper
export const PROSPER_STAKING_CONTRACT_ADDRESS =
	"0xdAdE4d372F57E325b34fB45fDf7bAaCBE6B760B5"; // staking contract prosper/eth lp
export const PROSPER_TOKEN_ADDRESS =
	"0x8Ff64D734C614fEd508F6673CE65717Cc1d8B6c8"; // prosper
export const PROSPER_STAKING_TOKEN =
	"0x75CBCa884c3cca9802a63D805c8b0f1C7110Ded7"; // prosper/eth lp
export const RSP_STAKING_CONTRACT_ADDRESS =
	"0xb9EAfef078A903C16c269bD63A5F5D5636c4004C"; // staking contract rsp/eth lp
export const RSP_TOKEN_ADDRESS = "0x6F8097E84fdD24C482d1982416f85CF32De594F5"; // rsp
export const RSP_STAKING_TOKEN = "0x5131c2D2DdCBfdA5F5b5A7a9D5C173A99Eb36C5b"; // rsp/eth lp
const RPC_URL =
	"https://base-mainnet.infura.io/v3/f2ace3972c5d4c75bfd063d4016d423a";

const ABI = [
	{
		inputs: [
			{
				internalType: "contract IERC20Metadata",
				name: "_rewardToken",
				type: "address",
			},
		],
		name: "addRewardPool",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "adminWithdrawUnstakeFee",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "exit",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_pid",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "_reward",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "_duration",
				type: "uint256",
			},
		],
		name: "extendRewardPool",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "getReward",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "removeETH",
		outputs: [
			{
				internalType: "bool",
				name: "status",
				type: "bool",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "renounceOwnership",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "newLockTime",
				type: "uint256",
			},
		],
		name: "setLockTime",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "_stakingToken",
				type: "address",
			},
			{
				internalType: "address",
				name: "_treasury",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "_stakingFee",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "_tokenFee",
				type: "uint256",
			},
		],
		stateMutability: "nonpayable",
		type: "constructor",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "previousOwner",
				type: "address",
			},
			{
				indexed: true,
				internalType: "address",
				name: "newOwner",
				type: "address",
			},
		],
		name: "OwnershipTransferred",
		type: "event",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "_token",
				type: "address",
			},
		],
		name: "rescueTokens",
		outputs: [
			{
				internalType: "bool",
				name: "status",
				type: "bool",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "user",
				type: "address",
			},
			{
				indexed: false,
				internalType: "address",
				name: "rewardToken",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "rewardAmount",
				type: "uint256",
			},
		],
		name: "RewardPaid",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "rewardPoolID",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "address",
				name: "rewardTokenAddress",
				type: "address",
			},
		],
		name: "RewardPoolAdded",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "rewardPoolID",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "address",
				name: "rewardTokenAddress",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "oldRewardAmount",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "newRewardAmount",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "totalRewardAmount",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "rewardDuration",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "rewardPeriodFinish",
				type: "uint256",
			},
		],
		name: "RewardPoolExtended",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "rewardPoolID",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "address",
				name: "rewardTokenAddress",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "rewardAmount",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "rewardDuration",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "rewardPeriodFinish",
				type: "uint256",
			},
		],
		name: "RewardPoolStarted",
		type: "event",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "_treasury",
				type: "address",
			},
		],
		name: "setNewTreasury",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "stake",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "user",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "Staked",
		type: "event",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_pid",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "_reward",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "_duration",
				type: "uint256",
			},
		],
		name: "startRewardPool",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "newOwner",
				type: "address",
			},
		],
		name: "transferOwnership",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "withdraw",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "user",
				type: "address",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "Withdrawn",
		type: "event",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		name: "addedRewardTokens",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "account",
				type: "address",
			},
		],
		name: "balanceOf",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "stakingFee",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "account",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "_pid",
				type: "uint256",
			},
		],
		name: "earned",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_pid",
				type: "uint256",
			},
		],
		name: "endTime",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "_pid",
				type: "uint256",
			},
		],
		name: "lastTimeRewardsActive",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "lockTime",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "owner",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		name: "poolInfo",
		outputs: [
			{
				internalType: "contract IERC20Metadata",
				name: "rewardToken",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "rewardPoolID",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "duration",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "periodFinish",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "startTime",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "lastUpdateTime",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "rewardRate",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "rewardPerTokenStored",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "poolLength",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" }],
		name: "rewardPerToken",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		name: "rewardsInPool",
		outputs: [
			{
				internalType: "uint256",
				name: "rewards",
				type: "uint256",
			},
			{
				internalType: "uint256",
				name: "userRewardPerTokenPaid",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "stakingToken",
		outputs: [
			{
				internalType: "contract IERC20Metadata",
				name: "",
				type: "address",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "stakingTokenMultiplier",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "tokenFee",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "totalSupply",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "treasury",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		name: "unstakeableTime",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "unstakeFee",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
];

export const getContract = (address: string, signer?: Signer) => {
	try {
		const provider = new JsonRpcProvider(RPC_URL);
		elizaLogger.info(`Getting contract for ${address}`);
		elizaLogger.info(`Signer: ${signer}`);
		elizaLogger.info(`Provider: ${provider}`);
		return new Contract(address, ABI, signer || provider);
	} catch (error) {
		elizaLogger.error(`Failed to get contract: ${error}`);
		throw error;
	}
};

export const getTotalTokenStaked = async (token: "PROSPER" | "RSP") => {
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
	);
	const totalSupply = await contract.totalSupply();
	elizaLogger.info(`Total Staked: ${totalSupply}`);
	return formatUnits(totalSupply, 18);
};

const cache = {
	PROSPER: { price: null as number | null, timestamp: 0 },
	RSP: { price: null as number | null, timestamp: 0 },
};

const CACHE_DURATION = 5 * 60 * 1000; // Cache duration in milliseconds (e.g., 5 minutes)
const MAX_RETRIES = 3; // Maximum number of retries
const RETRY_DELAY = 1000; // Delay between retries in milliseconds (e.g., 1 second)

export const getLPPrice = async (token: "PROSPER" | "RSP") => {
	const currentTime = Date.now();

	// Check if the cached value is still valid
	if (
		cache[token].price !== null &&
		currentTime - cache[token].timestamp < CACHE_DURATION
	) {
		elizaLogger.info(
			`Returning cached price for ${token}: ${cache[token].price}`,
		);
		return cache[token].price;
	}

	const tokenAddress =
		token === "PROSPER" ? PROSPER_TOKEN_ADDRESS : RSP_TOKEN_ADDRESS;
	// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
	let response;
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			response = await axios.get(`/api/token_price?address=${tokenAddress}`);
			break; // Exit loop if request is successful
		} catch (error) {
			console.error(`Attempt ${attempt + 1} failed:`, error);
			if (attempt < MAX_RETRIES - 1) {
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY)); // Wait before retrying
			} else {
				throw new Error("Failed to fetch token price after multiple attempts");
			}
		}
	}

	if (!response) {
		throw new Error("Failed to fetch token price after multiple attempts");
	}

	elizaLogger.info(`Response: ${JSON.stringify(response.data)}`);

	const totalLiquidityUSD = BigInt(
		Math.floor(
			Number.parseFloat(response.data.price.totalLiquidityUSD.toString()),
		),
	);
	elizaLogger.info(`Total Liquidity USD: ${totalLiquidityUSD}`);

	const contract = getContract(
		token === "PROSPER" ? PROSPER_STAKING_TOKEN : RSP_STAKING_TOKEN,
	);
	let totalLPSupply = BigInt(await contract.totalSupply());
	elizaLogger.info(`Total Supply: ${totalLPSupply}`);
	if (totalLPSupply === BigInt(0)) {
		totalLPSupply = BigInt(9999999999999999999000n);
	}

	// Calculate liquidity pool price as a floating-point number
	const liquidityPoolPrice = Number(totalLiquidityUSD) / Number(totalLPSupply);
	elizaLogger.info(`Token Price: ${liquidityPoolPrice}`);

	// Update the cache
	cache[token] = { price: liquidityPoolPrice, timestamp: currentTime };

	return liquidityPoolPrice; // Return as a number
};

export const getTotalAmountStaked = async (token: "PROSPER" | "RSP") => {
	const tokenPrice = await getLPPrice(token);
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
	);
	const totalSupply = BigInt(await contract.totalSupply());

	// if (totalSupply === BigInt(0)) {
	//   totalSupply = BigInt(9999999999999999999000);
	// }
	elizaLogger.info(`Total Supply: ${totalSupply}`);

	// Calculate total staked USD using number arithmetic
	const totalStakedUSD = Number(totalSupply) * tokenPrice;

	elizaLogger.info(`Total Staked USD: ${totalStakedUSD}`);
	elizaLogger.info(`Token Price: ${tokenPrice}`);

	return totalStakedUSD.toFixed(4); // Return as a formatted string
};

export const getUserStaked = async (
	userWallet: string,
	token: "PROSPER" | "RSP",
) => {
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
	);
	const balance = await contract.balanceOf(userWallet);
	return formatUnits(balance, 18);
};

export const getAvailableRewards = async (
	userWallet: string,
	token: "PROSPER" | "RSP",
) => {
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
	);
	const rewards = await contract.earned(userWallet, 0);
	return formatUnits(rewards, 18);
};

export const claimReward = async (signer: Signer, token: "PROSPER" | "RSP") => {
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
		signer,
	);
	const tx = await contract.getReward();
	await tx.wait();
};

export const unstake = async (signer: Signer, token: "PROSPER" | "RSP") => {
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
		signer,
	);
	const tx = await contract.exit();
	await tx.wait();
};

export const stake = async (
	signer: Signer,
	amount: string,
	token: "PROSPER" | "RSP",
) => {
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
		signer,
	);
	const tx = await contract.stake(amount);
	await tx.wait();
};

export const getAvailableToken = async (
	userWallet: string,
	token: "PROSPER" | "RSP",
) => {
	const provider = new JsonRpcProvider(RPC_URL);
	const prosperContract = new Contract(
		token === "PROSPER" ? PROSPER_STAKING_TOKEN : RSP_STAKING_TOKEN,
		ABI,
		provider,
	); // token being staked
	const balance = await prosperContract.balanceOf(userWallet);
	return formatUnits(balance, 18);
};

export const getRewardPerToken = async (token: "PROSPER" | "RSP") => {
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
	);
	const rewardPerToken = await contract.rewardPerToken(0);
	return formatUnits(rewardPerToken, 18);
};

export const getStakingTokenMultiplier = async (token: "PROSPER" | "RSP") => {
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
	);
	const multiplier = await contract.stakingTokenMultiplier();
	return formatUnits(multiplier, 18);
};

export const calculateAPR = async (address: string) => {
	const contract = getContract(address);

	// Fetch poolInfo and extract rewardRate
	const poolInfo = await contract.poolInfo(0);
	const rewardRate = BigInt(poolInfo[6].toString());
	console.log(`Reward Rate for ${address}:`, rewardRate.toString());

	// Calculate rewards per year using rewardRate
	const secondsInYear = BigInt(365 * 24 * 60 * 60);
	const rewardPerYear = rewardRate * secondsInYear;
	console.log(`Reward Per Year for ${address}:`, rewardPerYear.toString());

	let totalSupply = BigInt((await contract.totalSupply()).toString());
	if (totalSupply === BigInt(0)) {
		console.warn(`Total Supply for ${address} is zero, using default value.`);
		// Use a safer default value to avoid precision loss
		totalSupply = BigInt("9999999999999999999000");
	}
	elizaLogger.info(`Total Supply for ${address}: ${totalSupply.toString()}`);

	// Calculate APR
	elizaLogger.info(`Reward Per Year: ${rewardPerYear.toString()}`);
	const apr = (rewardPerYear / BigInt(totalSupply)) * BigInt(100);
	elizaLogger.info(`APR for ${address}: ${apr.toString()}`);

	return apr;
};

export const fetchUnstakeableTime = async (
	userWallet: string,
	token: "PROSPER" | "RSP",
) => {
	const contract = getContract(
		token === "PROSPER"
			? PROSPER_STAKING_CONTRACT_ADDRESS
			: RSP_STAKING_CONTRACT_ADDRESS,
	);
	const unstakeableTime = await contract.unstakeableTime(userWallet);
	return Number.parseInt(unstakeableTime.toString(), 10);
};

/**
 * Formats a number to USD currency string
 * @param {number} value - The number to format
 * @returns {string} - Formatted currency string
 */
export function formatUSD(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

/**
 * Safely converts a value to a number and handles formatting
 * @param {any} value - The value to convert
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted number string
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function safeNumberFormat(value: any, decimals = 2) {
	const number = Number(value);
	return Number.isNaN(number) ? "0.00" : number.toFixed(decimals);
}

export const fetchTokenPrice = async (
	runtime: IAgentRuntime,
	tokenAddress: string,
	chainId = "0x2105",
) => {
	if (
		runtime.getSetting("MORALIS_API_KEY") == null ||
		runtime.getSetting("MORALIS_API_KEY") === ""
	) {
		elizaLogger.error("MORALIS_API_KEY is not set");
		throw new Error("MORALIS_API_KEY is not set");
	}
	try {
		// what about solana
		const response = await axios.get(
			`https://deep-index.moralis.io/api/v2/erc20/${tokenAddress}/price`,
			{
				params: {
					chain: chainId,
					include: "percent_change",
				},
				headers: {
					"X-API-Key": runtime.getSetting("MORALIS_API_KEY"),
				},
			},
		);

		const tokenPrice = Number(response.data.usdPrice) || 0;
		const priceChange24h = Number(response.data["24hrPercentChange"]) || 0;
		const totalLiquidityUSD = Number(response.data.pairTotalLiquidityUsd) || 0;
		elizaLogger.info(`Token Price: ${tokenPrice}`);
		elizaLogger.info(`Price Change 24h: ${priceChange24h}`);
		elizaLogger.info(`Total Liquidity USD: ${totalLiquidityUSD}`);
		return {
			current: tokenPrice,
			change24h: priceChange24h,
			totalLiquidityUSD: totalLiquidityUSD,
		};
	} catch (error) {
		console.error("Error fetching token price:", error);
		throw error;
	}
};
