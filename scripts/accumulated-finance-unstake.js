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

// stROSE contract ABI for unstaking
const STROSE_ABI = [
	{
		name: "unstake",
		inputs: [
			{
				internalType: "uint256",
				name: "shares",
				type: "uint256",
			},
			{
				internalType: "address",
				name: "receiver",
				type: "address",
			},
			{
				internalType: "address",
				name: "owner",
				type: "address",
			},
		],
		outputs: [
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256",
			},
		],
		stateMutability: "nonpayable",
		type: "function",
	},
];

// Configuration
const _NETWORK_ID = SAPPHIRE_MAINNET.CHAIN_ID;
const CONTRACT_ADDRESS = SAPPHIRE_MAINNET.CONTRACTS.UNSTAKED_ROSE;
const RPC_URL = SAPPHIRE_MAINNET.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RECEIVER_ADDRESS = "0xD952175d6A20187d7A5803DcC9741472F640A9b8";
const OWNER_ADDRESS = "0xD952175d6A20187d7A5803DcC9741472F640A9b8"; // Same as receiver for this example
const UNSTAKE_SHARES = "5"; // Amount of shares to unstake

async function unstakeRose() {
	try {
		// Initialize ethers provider
		const provider = new ethers.JsonRpcProvider(RPC_URL);

		// Get signer from private key
		const signer = new ethers.Wallet(PRIVATE_KEY, provider);

		// Create contract instance
		const contract = new ethers.Contract(CONTRACT_ADDRESS, STROSE_ABI, signer);

		console.log("Preparing to unstake ROSE...");
		console.log({
			contractAddress: CONTRACT_ADDRESS,
			unstakeShares: UNSTAKE_SHARES,
			receiver: RECEIVER_ADDRESS,
			owner: OWNER_ADDRESS,
		});

		// Call the unstake function
		const tx = await contract.unstake(
			ethers.parseEther(UNSTAKE_SHARES),
			RECEIVER_ADDRESS,
			OWNER_ADDRESS,
			{
				gasLimit: 300000, // Adjust gas limit as needed
			},
		);

		console.log("Transaction sent:", tx.hash);

		// Wait for transaction to be mined
		const receipt = await tx.wait();
		console.log("Transaction mined:", receipt.transactionHash);
		console.log("Gas used:", receipt.gasUsed.toString());
	} catch (error) {
		console.error("Error unstaking ROSE:", error);
		if (error.code === "INSUFFICIENT_FUNDS") {
			console.error("Insufficient funds for transaction");
		} else if (error.code === "NETWORK_ERROR") {
			console.error("Network error occurred");
		} else {
			console.error("Unknown error:", error.message);
		}
	}
}

// Execute the unstake function
unstakeRose();
