const { ethers } = require("ethers");

const SAPPHIRE_MAINNET = {
	RPC_URL: "https://sapphire.oasis.io",
	CHAIN_ID: 0x5afe,
	EXPLORER_URL: "https://explorer.oasis.io/mainnet/sapphire",
	CONTRACTS: {
		WRAPPED_ROSE: "0x3cabbe76ea8b4e7a2c0a69812cbe671800379ec8", // wstROSE contract
		UNWRAPPED_ROSE: "0x3cabbe76ea8b4e7a2c0a69812cbe671800379ec8", // Native ROSE token
		UNSTAKED_ROSE: "0x04fAf6897Cf5de4Ab9f1052fA16Ec9256c3ea44a", // Unstaked ROSE token
	},
};

// stROSE contract ABI for staking
const ABI = [
	{
		inputs: [
			{
				internalType: "uint256",
				name: "assets",
				type: "uint256",
			},
			{
				internalType: "address",
				name: "receiver",
				type: "address",
			},
		],
		name: "deposit",
		outputs: [
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "spender",
				type: "address",
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		name: "approve",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
];

// Configuration
const _NETWORK_ID = SAPPHIRE_MAINNET.CHAIN_ID;
const CONTRACT_ADDRESS = SAPPHIRE_MAINNET.CONTRACTS.WRAPPED_ROSE;
const RPC_URL = SAPPHIRE_MAINNET.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RECEIVER_ADDRESS = "0xD952175d6A20187d7A5803DcC9741472F640A9b8";
const STAKE_AMOUNT = "1"; // Amount of ROSE to stake

async function stakeRose() {
	try {
		// Initialize ethers provider
		const provider = new ethers.JsonRpcProvider(RPC_URL);

		// Get signer from private key
		const signer = new ethers.Wallet(PRIVATE_KEY, provider);

		// Create contract instances
		const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

		console.log("Preparing to stake ROSE...");
		console.log({
			contractAddress: CONTRACT_ADDRESS,
			stakeAmount: STAKE_AMOUNT,
			receiver: RECEIVER_ADDRESS,
		});

		// First approve the staking contract to spend ROSE
		console.log("Approving ROSE spending...");
		const approveTx = await contract.approve(
			CONTRACT_ADDRESS,
			ethers.parseEther(STAKE_AMOUNT),
			{
				gasLimit: 100000,
			},
		);
		console.log("Approval transaction sent:", approveTx.hash);
		await approveTx.wait();
		console.log("Approval confirmed");

		// Call the stake function
		const tx = await contract.deposit(
			ethers.parseEther(STAKE_AMOUNT),
			RECEIVER_ADDRESS,
			{
				gasLimit: 300000, // Adjust gas limit as needed
			},
		);

		console.log("Staking transaction sent:", tx.hash);

		// Wait for transaction to be mined
		const receipt = await tx.wait();
		console.log("Transaction mined:", receipt.transactionHash);
		console.log("Gas used:", receipt.gasUsed.toString());
	} catch (error) {
		console.error("Error staking ROSE:", error);
		if (error.code === "INSUFFICIENT_FUNDS") {
			console.error("Insufficient funds for transaction");
		} else if (error.code === "NETWORK_ERROR") {
			console.error("Network error occurred");
		} else {
			console.error("Unknown error:", error.message);
		}
	}
}

// Execute the stake function
stakeRose();
