const { ethers } = require("ethers");

const SAPPHIRE_MAINNET = {
	RPC_URL: "https://sapphire.oasis.io",
	CHAIN_ID: 0x5afe,
	EXPLORER_URL: "https://explorer.oasis.io/mainnet/sapphire",
	CONTRACTS: {
		// UNSTAKE: "0x04faf6897cf5de4ab9f1052fa16ec9256c3ea44a", // Removed - Not used in current implementation
		WRAPPED_ROSE: "0x3cabbe76ea8b4e7a2c0a69812cbe671800379ec8", // wstROSE contract (wrapped staked ROSE)
		UNWRAPPED_ROSE: "0x3cabbe76ea8b4e7a2c0a69812cbe671800379ec8", // Native ROSE token
		UNSTAKED_ROSE: "0x04fAf6897Cf5de4Ab9f1052fA16Ec9256c3ea44a", // Unstaked ROSE token
	},
};

// stROSE contract ABI based on the contract source code
const STROSE_ABI = [
	{
		name: "deposit",
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address",
			},
		],
		outputs: [
			{
				internalType: "uint256",
				name: "value",
				type: "uint256",
			},
		],
		stateMutability: "payable",
		type: "function",
	},
];

// Configuration
const _NETWORK_ID = SAPPHIRE_MAINNET.CHAIN_ID;
const CONTRACT_ADDRESS = SAPPHIRE_MAINNET.CONTRACTS.UNSTAKED_ROSE;
const RPC_URL = SAPPHIRE_MAINNET.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RECEIVER_ADDRESS = "0xD952175d6A20187d7A5803DcC9741472F640A9b8";
const SHARES_AMOUNT = "5"; // Amount of shares to mint

async function mintStRose() {
	try {
		// Initialize ethers provider
		const provider = new ethers.JsonRpcProvider(RPC_URL);

		// Get signer from private key
		const signer = new ethers.Wallet(PRIVATE_KEY, provider);

		// Create contract instance
		const contract = new ethers.Contract(CONTRACT_ADDRESS, STROSE_ABI, signer);

		console.log("Preparing to mint stROSE shares...");
		console.log({
			contractAddress: CONTRACT_ADDRESS,
			sharesAmount: SHARES_AMOUNT,
			receiver: RECEIVER_ADDRESS,
		});

		// Call the deposit function
		const tx = await contract.deposit(RECEIVER_ADDRESS, {
			value: ethers.parseEther(SHARES_AMOUNT),
			gasLimit: 300000, // Adjust gas limit as needed
		});

		console.log("Transaction sent:", tx.hash);

		// Wait for transaction to be mined
		const receipt = await tx.wait();
		console.log("Transaction mined:", receipt.transactionHash);
		console.log("Gas used:", receipt.gasUsed.toString());
	} catch (error) {
		console.error("Error minting stROSE:", error);
		if (error.code === "INSUFFICIENT_FUNDS") {
			console.error("Insufficient funds for transaction");
		} else if (error.code === "NETWORK_ERROR") {
			console.error("Network error occurred");
		} else {
			console.error("Unknown error:", error.message);
		}
	}
}

// Execute the mint function
mintStRose();

// Result:
/*
$ node scripts/accumulated-finance-mint.js
Preparing to mint stROSE shares...
{
  contractAddress: '0x04fAf6897Cf5de4Ab9f1052fA16Ec9256c3ea44a',
  sharesAmount: '5',
  receiver: '0xD952175d6A20187d7A5803DcC9741472F640A9b8'
}
Transaction sent: 0x48e5455fb130adfe7de8ba86feeb39bffc45ecb679bc55d8c26ed0c6b8846a14
Transaction mined: undefined
Gas used: 52253
*/
