import {
	ChainId,
	CurrencyAmount,
	MULTICALL_ADDRESSES,
	Percent,
	Token,
	TradeType,
} from "@uniswap/sdk-core";
import { AlphaRouter } from "@uniswap/smart-order-router";
import {
	SwapRouter,
	UNIVERSAL_ROUTER_ADDRESS,
} from "@uniswap/universal-router-sdk";
import dotenv from "dotenv";
import { ethers } from "ethers";
// import MulticallJSON from '@uniswap/v3-periphery/artifacts/contracts/lens/UniswapInterfaceMulticall.sol/UniswapInterfaceMulticall.json';

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
		ROSE: "0xed57966f1566de1a90042d07403021ea52ad4724", // Native ROSE token
		wROSE: "0x8Bc2B030b299964eEfb5e1e0b36991352E56D2D3", // Celer-bridged wROSE
		USDC: "0x3cabbe76ea8b4e7a2c0a69812cbe671800379ec8", // USDC stablecoin on Sapphire
		WETH: "0xB6dc6C8b71e88642cEAD3be1025565A9eE74d1C6", // Wrapped ETH on Sapphire (Celer-bridged)
		WBTC: "0xB65548d5A38F4652C26a4B0d5B0Af19E59F37B53", // Wrapped BTC on Sapphire
	},
};

dotenv.config();

// Configuration
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY; // Your private key
const RPC_URL = SAPPHIRE_MAINNET.RPC_URL; // Your RPC URL
const CHAIN_ID = SAPPHIRE_MAINNET.CHAIN_ID; // Sapphire mainnet

// Token addresses
const ROSE_ADDRESS = SAPPHIRE_MAINNET.TOKENS.ROSE; // Native ROSE token
const USDC_ADDRESS = SAPPHIRE_MAINNET.TOKENS.USDC; // USDC stablecoin on Sapphire

async function main() {
	// Setup provider and signer
	const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
	const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

	console.log("Provider block number:", await provider.getBlockNumber());
	console.log("Wallet address:", wallet.address);

	// Create token instances
	const ROSE = new Token(CHAIN_ID, ROSE_ADDRESS, 18, "ROSE", "Oasis ROSE");
	const USDC = new Token(CHAIN_ID, USDC_ADDRESS, 6, "USDC", "USD Coin");

	console.log("ROSE address:", ROSE.address);
	console.log("USDC address:", USDC.address);

	// Amount to swap (0.1 ROSE)
	const amountIn = CurrencyAmount.fromRawAmount(
		ROSE,
		ethers.utils.parseUnits("0.1", 18),
	);

	console.log("Amount in:", amountIn.toExact());

	// Create new router instance
	const router = new AlphaRouter({ chainId: CHAIN_ID, provider });

	// Get quote
	const route = await router.route(amountIn, USDC, TradeType.EXACT_INPUT, {
		recipient: wallet.address,
		slippageTolerance: new Percent(50, 10000), // 0.5%
		deadline: Math.floor(Date.now() / 1000 + 1800), // 30 minutes
	});

	if (!route) {
		throw new Error("No route found");
	}

	// Prepare swap parameters
	const { calldata, value } = SwapRouter.swapERC20CallParameters(route.trade, {
		slippageTolerance: new Percent(50, 10000),
		deadlineOrPreviousBlockhash: Math.floor(
			Date.now() / 1000 + 1800,
		).toString(),
	});

	// Prepare transaction
	const tx = {
		from: wallet.address,
		to: UNIVERSAL_ROUTER_ADDRESS(CHAIN_ID),
		data: calldata,
		value: value ? ethers.toBeHex(value) : undefined,
	};

	try {
		// Estimate gas
		const gasEstimate = await provider.estimateGas(tx);
		const gasLimit = (gasEstimate * 120n) / 100n; // Add 20% margin

		// Send transaction
		const response = await wallet.sendTransaction({
			...tx,
			gasLimit,
		});

		console.log("Transaction sent:", response.hash);

		// Wait for confirmation
		const receipt = await response.wait();
		console.log("Transaction confirmed:", receipt);
	} catch (error) {
		console.error("Error executing swap:", error);
	}
}

main().catch(console.error);
