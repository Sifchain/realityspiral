/**
 * @file perpUtilsExamples.ts
 * @description Examples of using the SynFutures Perp utility functions
 *
 * This file demonstrates how to use the utility functions defined in perpUtils.ts
 * to interact with the SynFutures Perpetual contracts.
 */

import { elizaLogger } from "@elizaos/core";
import { Side } from "@synfutures/sdks-perp";
import dotenv from "dotenv";
import { ethers } from "ethers";
import {
	closePosition,
	depositToGate,
	getAllInstruments,
	getInstrumentBySymbol,
	getPortfolio,
	initContext,
	placeLimitOrder,
	placeMarketOrder,
	withdrawFromGate,
} from "./perpUtils";

dotenv.config();

async function main() {
	// Setup a wallet for demonstration
	// In a real application, you would use a more secure method to handle private keys
	if (!process.env.BASE_RPC_URL) {
		throw new Error("BASE_RPC_URL environment variable is required");
	}

	if (!process.env.WALLET_PRIVATE_KEY) {
		throw new Error("WALLET_PRIVATE_KEY environment variable is required");
	}

	// Create a provider directly
	const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
	const signer = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);

	// Initialize the context
	await initContext();
	elizaLogger.info("Context initialized successfully");

	// Example 1: Deposit tokens to Gate for trading
	elizaLogger.info("EXAMPLE 1: Depositing 1 USDC to Gate...");
	try {
		await depositToGate("USDC", "1", signer);
		elizaLogger.info(
			"Deposit completed successfully - funds are now available for trading",
		);
	} catch (error) {
		elizaLogger.error("Deposit failed:", error);
	}

	// Example 2: Place a LONG market order with leverage
	elizaLogger.info(
		"EXAMPLE 2: Placing a LONG market order on BTC-USDC-LINK with 10x leverage...",
	);
	try {
		await placeMarketOrder("BTC-USDC-LINK", Side.LONG, "1", "10", signer);
		elizaLogger.info(
			"Market order placed successfully - you now have a LONG position",
		);
	} catch (error) {
		elizaLogger.error("Market order failed:", error);
	}

	// Example 3: Place a limit order
	elizaLogger.info(
		"EXAMPLE 3: Placing a SHORT limit order on ETH-USDC-LINK with 5x leverage...",
	);
	try {
		// 100 tick offset means roughly 1% higher than current price
		await placeLimitOrder("ETH-USDC-LINK", Side.SHORT, "1", "5", 100, signer);
		elizaLogger.info(
			"Limit order placed successfully - it will execute when price reaches the target level",
		);
	} catch (error) {
		elizaLogger.error("Limit order failed:", error);
	}

	// Example 4: Close an existing position
	elizaLogger.info("EXAMPLE 4: Closing the BTC-USDC-LINK position...");
	try {
		await closePosition("BTC-USDC-LINK", signer);
		elizaLogger.info("Position closed successfully");
	} catch (error) {
		elizaLogger.error("Position closing failed:", error);
	}

	// Example 5: Withdraw funds from Gate
	elizaLogger.info("EXAMPLE 5: Withdrawing 1 USDC from Gate...");
	try {
		await withdrawFromGate("USDC", "1", signer);
		elizaLogger.info("Withdrawal completed successfully");
	} catch (error) {
		elizaLogger.error("Withdrawal failed:", error);
	}

	// Example 6: Get and display all instruments
	elizaLogger.info("EXAMPLE 6: Getting all available instruments...");
	try {
		const instruments = await getAllInstruments();
		elizaLogger.info(`Found ${instruments.length} instruments:`);
		// biome-ignore lint/complexity/noForEach: <explanation>
		instruments.forEach((instrument) => {
			elizaLogger.info(`- ${instrument.symbol}`);
		});
	} catch (error) {
		elizaLogger.error("Failed to get instruments:", error);
	}

	// Example 7: Get portfolio for a specific instrument
	elizaLogger.info("EXAMPLE 7: Getting portfolio for BTC-USDC-LINK...");
	try {
		const instrument = await getInstrumentBySymbol("BTC-USDC-LINK");
		const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)
		const portfolio = await getPortfolio(
			signer.address,
			instrument.instrumentAddr,
			expiry,
		);
		elizaLogger.info(
			`Portfolio retrieved successfully. Position size: ${portfolio.position.size}`,
		);
	} catch (error) {
		elizaLogger.error("Failed to get portfolio:", error);
	}
}

main().catch(console.error);

// Export the main function for external use
export default main;
