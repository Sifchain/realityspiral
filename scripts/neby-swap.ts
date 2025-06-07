import { ethers } from "ethers";
import ERC20ABI from "./neby-abis/ERC20.json";
import RouterABI from "./neby-abis/Router02.json";

// Private key for the wallet
const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY;

// check if private key is defined
if (!WALLET_PRIVATE_KEY) {
	throw new Error("PRIVATE_KEY is not defined");
}

// Oasis Sapphire Mainnet details
export const SAPPHIRE_MAINNET = {
	RPC_URL: "https://sapphire.oasis.io",
	CHAIN_ID: 0x5afe,
	EXPLORER_URL: "https://explorer.oasis.io/mainnet/sapphire",
	CONTRACTS: {
		V3_CORE_FACTORY: "0x218D71cd52363B7A47cD31549f3b9031d74A585A",
		MULTICALL: "0x05568F4E3e4F0c3E7b8664e302f269574fEAD13A",
		QUOTER: "0xA7A00B2493F362B5232337398C0eC6052165464c",
		NFT_POSITION_MANAGER: "0x2D69C85166B8B84916EF49FF20f287f9Eb6381fe",
		TICK_LENS: "0x96488E235627Fd7A5a82B555dbbfd1F0d268C757",
		SWAP_ROUTER_02: "0x6Dd410DbF04b2C197353CD981eCC374906eB62F6",
		HARVESTER: "0xE310Bce86F2ff352C091e2257943bfd0923cb1Df",
		LIQUIDITY_POSITION_STAKER: "0x7A0D1E8AE82E163bAdBF7bd563111F3b05F07c46",
		NEBY_STAKER: "0x269Ddf6666BA65dAa32ca526fa1F14D9aC7dD3b4",
		UNIVERSAL_ROUTER: "0xd099ef034EaAbFb7db7334B9b3E8a0dA4d50949a",
		PERMIT2: "0xA3dF2613A995693E81a6e3a8Ea3fcB770c5fF800",
	},
	// Common token addresses
	TOKENS: {
		wROSE: "0x8Bc2B030b299964eEfb5e1e0b36991352E56D2D3", // Celer-bridged wROSE
		wstROSE: "0x3cAbbe76Ea8B4e7a2c0a69812CBe671800379eC8", // wstROSE
		USDC: "0x97eec1c29f745dC7c267F90292AA663d997a601D", // USDC stablecoin on Sapphire
		WETH: "0xB6dc6C8b71e88642cEAD3be1025565A9eE74d1C6", // Wrapped ETH on Sapphire (Celer-bridged)
	},
};

// Token name mapping
const TOKEN_NAMES: { [key: string]: string } = {
	[SAPPHIRE_MAINNET.TOKENS.wROSE]: "wROSE",
	[SAPPHIRE_MAINNET.TOKENS.wstROSE]: "wstROSE",
	[SAPPHIRE_MAINNET.TOKENS.USDC]: "USDC",
	[SAPPHIRE_MAINNET.TOKENS.WETH]: "WETH",
};

// Token decimals mapping
const TOKEN_DECIMALS: { [key: string]: number } = {
	[SAPPHIRE_MAINNET.TOKENS.wROSE]: 18,
	[SAPPHIRE_MAINNET.TOKENS.wstROSE]: 18,
	[SAPPHIRE_MAINNET.TOKENS.USDC]: 18,
	[SAPPHIRE_MAINNET.TOKENS.WETH]: 18,
};

/**
 * This example works on sapphire testnet
 * */

// Production ROUTER Address 0x6Dd410DbF04b2C197353CD981eCC374906eB62F6
// const ROUTER_ADDRESS = "0x5dbFD9d19c81021b6dbCb8766d853C7bB761a957";
const ROUTER_ADDRESS = SAPPHIRE_MAINNET.CONTRACTS.SWAP_ROUTER_02;

// Production change this to https://sapphire.oasis.io
const provider = new ethers.JsonRpcProvider(SAPPHIRE_MAINNET.RPC_URL);

const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);

// Testnet tokens
const tokenIn = SAPPHIRE_MAINNET.TOKENS.wROSE;
const tokenOut = SAPPHIRE_MAINNET.TOKENS.USDC;

const amountIn = ethers.parseUnits("0.1", 18); // Token with 6 decimals

// Define your slippage here, 100% slippage currently
const amountOutMin = ethers.parseUnits("0", 18);

async function approveToken() {
	const tokenContract = new ethers.Contract(tokenIn, ERC20ABI, wallet);
	const tokenName = TOKEN_NAMES[tokenIn] || "Unknown Token";
	const tokenDecimals = TOKEN_DECIMALS[tokenIn] || 18;

	console.log("\n=== Token Approval Process ===");
	console.log(`Token In Address: ${tokenIn}`);
	console.log(`Router Address: ${ROUTER_ADDRESS}`);
	console.log(
		`Amount to Approve: ${ethers.formatUnits(amountIn, tokenDecimals)} ${tokenName}`,
	);

	console.log("\nApproving router to spend tokenIn...");
	const approvalTx = await tokenContract.approve(ROUTER_ADDRESS, amountIn);
	console.log(`Approval transaction submitted: ${approvalTx.hash}`);
	console.log(
		`View transaction: ${SAPPHIRE_MAINNET.EXPLORER_URL}/tx/${approvalTx.hash}`,
	);

	console.log("\nWaiting for approval confirmation...");
	const receipt = await approvalTx.wait();
	console.log("Approval confirmed!");
	console.log(`Gas used: ${receipt.gasUsed.toString()}`);
	console.log(`Block number: ${receipt.blockNumber}`);
}

async function swapTokens() {
	const router = new ethers.Contract(ROUTER_ADDRESS, RouterABI, wallet);
	const to = wallet.address;
	const tokenInName = TOKEN_NAMES[tokenIn] || "Unknown Token";
	const tokenOutName = TOKEN_NAMES[tokenOut] || "Unknown Token";
	const tokenInDecimals = TOKEN_DECIMALS[tokenIn] || 18;

	// Set a deadline for the transaction (current time + 20 minutes)
	const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

	const swapParams = {
		tokenIn: tokenIn,
		tokenOut: tokenOut,
		fee: 3000,
		recipient: to,
		deadline: deadline,
		amountIn: amountIn,
		amountOutMinimum: amountOutMin,
		sqrtPriceLimitX96: 0,
	};

	console.log("\n=== Swap Process ===");
	console.log(`From Token: ${tokenIn} (${tokenInName})`);
	console.log(`To Token: ${tokenOut} (${tokenOutName})`);
	console.log(
		`Amount In: ${ethers.formatUnits(amountIn, tokenInDecimals)} ${tokenInName}`,
	);
	console.log(`Recipient: ${to}`);
	console.log(`Deadline: ${new Date(deadline * 1000).toISOString()}`);
	console.log(`Fee Tier: ${swapParams.fee / 10000}%`);

	console.log("\nSubmitting swap transaction...");
	const tx = await router.exactInputSingle(swapParams);
	console.log(`Swap transaction submitted: ${tx.hash}`);
	console.log(
		`View transaction: ${SAPPHIRE_MAINNET.EXPLORER_URL}/tx/${tx.hash}`,
	);

	console.log("\nWaiting for swap confirmation...");
	const receipt = await tx.wait();
	console.log("Swap confirmed!");
	console.log(`Transaction hash: ${receipt.hash}`);
	console.log(`Gas used: ${receipt.gasUsed.toString()}`);
	console.log(`Block number: ${receipt.blockNumber}`);

	// Log the events from the transaction
	console.log("\nTransaction Events:");
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	receipt.logs.forEach((log: any, index: number) => {
		console.log(`Event ${index + 1}:`);
		console.log(`  Address: ${log.address}`);
		console.log(`  Topics: ${log.topics.join(", ")}`);
		console.log(`  Data: ${log.data}`);
	});
}

const main = async () => {
	try {
		console.log("=== Starting Token Swap Process ===");
		console.log(
			`Network: Oasis Sapphire Mainnet (Chain ID: ${SAPPHIRE_MAINNET.CHAIN_ID})`,
		);
		console.log(`Wallet Address: ${wallet.address}`);

		await approveToken();
		await swapTokens();

		console.log("\n=== Swap Process Completed Successfully ===");
	} catch (error) {
		console.error("\n=== Error Occurred ===");
		console.error("Error details:", error);
		process.exit(1);
	}
};

void main();
