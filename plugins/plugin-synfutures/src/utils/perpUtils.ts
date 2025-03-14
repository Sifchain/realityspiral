/**
 * @file perpUtils.ts
 * @description Utility functions for interacting with SynFutures Perpetual contracts
 *
 * SynFutures@v3 implements Oyster AMM for derivatives trading, with the following key components:
 * - Instrument contracts: Core contracts for trading and liquidity operations
 * - Gate contracts: Manage margin transfers in/out of the system
 * - Observer: Query protocol data (instruments, portfolios, etc.)
 * - Simulate: Pre-operation simulation for better user experience
 *
 * This utility file provides simplified interfaces to interact with the SynFutures Perp SDK.
 */

import { Context } from "@derivation-tech/context";
import { txPlugin } from "@derivation-tech/tx-plugin";
import { BigNumber } from "@ethersproject/bignumber";
import { MaxUint256 } from "@ethersproject/constants";
import {
	type BatchOrderSizeDistribution,
	Portfolio,
	type Side,
	perpPlugin,
	utils,
} from "@synfutures/sdks-perp";
import dotenv from "dotenv";
import { type ethers, parseUnits } from "ethers";
import { TransactionReceipt } from "@ethersproject/providers";

dotenv.config();

// Ensure BASE_RPC_URL is defined or use a fallback
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

const ctx = new Context("base", {
	url: BASE_RPC_URL,
})
	.use(perpPlugin())
	.use(txPlugin());

// Helper function for parsing amounts
function parseAmount(amount: string, decimals = 18): BigNumber {
	return BigNumber.from(parseUnits(amount, decimals));
}

/**
 * Initialize the SynFutures Perp context
 * @returns The initialized Context object with perpPlugin
 */
export async function initContext() {
	await ctx.init();
	return ctx;
}

/**
 * Get all available instruments from the Observer
 * @returns An array of all instruments with their details
 */
export async function getAllInstruments() {
	return await ctx.perp.observer.getAllInstruments();
}

/**
 * Get a specific instrument by its symbol (e.g., BTC-USDC-LINK)
 * @param symbol - The instrument symbol to look up
 * @returns The instrument details if found
 */
export async function getInstrumentBySymbol(symbol: string) {
	return await ctx.perp.observer.getInstrument(symbol);
}

/**
 * Get a trader's portfolio for a specific instrument and expiry
 * @param traderAddr - The address of the trader
 * @param instrumentAddr - The address of the instrument contract
 * @param expiry - The expiry timestamp
 * @returns The portfolio details for the specified parameters
 */
export async function getPortfolio(
	traderAddr: string,
	instrumentAddr: string,
	expiry: number,
): Promise<Portfolio> {
	return await ctx.perp.observer.getPortfolio({
		traderAddr,
		instrumentAddr,
		expiry,
	});
}

/**
 * Deposit tokens to the Gate contract
 * @param tokenSymbol - The symbol of the token to deposit
 * @param amount - The amount to deposit as a string
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function depositToGate(
	tokenSymbol: string,
	amount: string,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const token = await ctx.getTokenInfo(tokenSymbol);
	return await ctx.perp.gate.deposit(
		token.address,
		parseAmount(amount, token.decimals),
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Withdraw tokens from the Gate contract
 * @param tokenSymbol - The symbol of the token to withdraw
 * @param amount - The amount to withdraw as a string
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function withdrawFromGate(
	tokenSymbol: string,
	amount: string,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const token = await ctx.getTokenInfo(tokenSymbol);
	return await ctx.perp.gate.withdraw(
		token.address,
		parseAmount(amount, token.decimals),
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Place a market order to open or modify a position
 * @param instrumentSymbol - The symbol of the instrument (e.g., BTC-USDC-LINK)
 * @param side - The side of the order (LONG or SHORT)
 * @param quoteAmount - The amount in quote asset to use for the order
 * @param leverage - The desired leverage as a string
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function placeMarketOrder(
	instrumentSymbol: string,
	side: Side,
	quoteAmount: string,
	leverage: string,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)

	const tradeInfo = {
		instrumentAddr: instrument.instrumentAddr,
		expiry,
		traderAddr: signer.address,
	};

	// Default slippage set to 1%
	const slippage = 100;

	// Simulate the market order to get the necessary parameters
	const result = await ctx.perp.simulate.simulateMarketOrderByLeverage({
		tradeInfo,
		side,
		size: { quote: parseAmount(quoteAmount) },
		slippage,
		leverage: parseAmount(leverage),
	});

	return await ctx.perp.instrument.placeMarketOrder(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			side,
			baseSize: result.size.base,
			margin: result.margin,
			limitTick: result.limitTick,
			deadline: Math.floor(Date.now() / 1000) + 300,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Close an existing position for a specific instrument
 * @param instrumentSymbol - The symbol of the instrument (e.g., BTC-USDC-LINK)
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function closePosition(
	instrumentSymbol: string,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)

	// Get the current position
	const portfolio = await getPortfolio(
		signer.address,
		instrument.instrumentAddr,
		expiry,
	);

	// Check if there's a position to close
	if (portfolio.position.size.eq(0)) {
		throw new Error("No position to close");
	}

	// Slippage set to 1%
	const slippage = 100;

	// Simulate closing the position
	const result = await ctx.perp.simulate.simulateClose({
		tradeInfo: portfolio.position,
		size: { base: portfolio.position.size.abs() },
		slippage,
	});

	return await ctx.perp.instrument.placeMarketOrder(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			side: utils.reverseSide(portfolio.position.side),
			baseSize: result.size.base,
			margin: result.margin,
			limitTick: result.limitTick,
			deadline: Math.floor(Date.now() / 1000) + 300,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Place a limit order for a specific instrument
 * @param instrumentSymbol - The symbol of the instrument
 * @param side - The side of the order (LONG or SHORT)
 * @param quoteAmount - The amount in quote asset to use for the order
 * @param leverage - The desired leverage as a string
 * @param tickOffset - The tick offset from the current market price
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function placeLimitOrder(
	instrumentSymbol: string,
	side: Side,
	quoteAmount: string,
	leverage: string,
	tickOffset: number,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)
	const amm = instrument.amms.get(expiry);

	if (!amm) {
		throw new Error(
			`No AMM found for ${instrumentSymbol} with expiry ${expiry}`,
		);
	}

	// Define target tick based on current AMM tick and offset
	// Ensure tick is aligned with PEARL_SPACING (ORDER_SPACING)
	const PEARL_SPACING = 5; // Assuming this is the correct spacing value
	const targetTick = utils.alignTick(amm.tick + tickOffset, PEARL_SPACING);

	// Trade info
	const tradeInfo = {
		instrumentAddr: instrument.instrumentAddr,
		expiry,
		traderAddr: signer.address,
	};

	// Simulate the limit order
	const result = await ctx.perp.simulate.simulateLimitOrder({
		tradeInfo,
		side,
		priceInfo: targetTick,
		size: { quote: parseAmount(quoteAmount) },
		leverage: parseAmount(leverage),
	});

	return await ctx.perp.instrument.placeLimitOrder(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			tick: result.tick,
			baseSize: result.size.base,
			side,
			margin: result.margin,
			deadline: Math.floor(Date.now() / 1000) + 300,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Cancel a limit order for a specific instrument
 * @param instrumentSymbol - The symbol of the instrument
 * @param tick - The tick of the order to cancel
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function cancelLimitOrder(
	instrumentSymbol: string,
	tick: number,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)

	return await ctx.perp.instrument.cancelLimitOrder(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			tick,
			deadline: Math.floor(Date.now() / 1000) + 60,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Place multiple scaled limit orders in a batch
 * @param instrumentSymbol - The symbol of the instrument
 * @param side - The side of the orders (LONG or SHORT)
 * @param quoteAmount - The total quote amount to distribute across the orders
 * @param leverage - The desired leverage as a string
 * @param lowerTickOffset - The lower tick offset from the current price
 * @param upperTickOffset - The upper tick offset from the current price
 * @param orderCount - The number of orders to place
 * @param sizeDistribution - The distribution pattern (FLAT, UPPER, LOWER, RANDOM)
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function placeBatchScaledLimitOrders(
	instrumentSymbol: string,
	side: Side,
	quoteAmount: string,
	leverage: string,
	lowerTickOffset: number,
	upperTickOffset: number,
	_orderCount: number,
	sizeDistribution: BatchOrderSizeDistribution,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)
	const amm = instrument.amms.get(expiry);

	if (!amm) {
		throw new Error(
			`No AMM found for ${instrumentSymbol} with expiry ${expiry}`,
		);
	}

	// Define the PEARL_SPACING (ORDER_SPACING)
	const PEARL_SPACING = 5;

	// Align the ticks with the spacing
	const lowerPriceInfo = utils.alignTick(
		amm.tick + lowerTickOffset,
		PEARL_SPACING,
	);
	const upperPriceInfo = utils.alignTick(
		amm.tick + upperTickOffset,
		PEARL_SPACING,
	);

	// Trade info
	const tradeInfo = {
		instrumentAddr: instrument.instrumentAddr,
		expiry,
		traderAddr: signer.address,
	};

	// Size by quote
	const sizeByQuote = {
		quote: parseAmount(quoteAmount),
	};

	// Simulate scaled limit orders
	const result = await ctx.perp.simulate.simulateScaledLimitOrder({
		tradeInfo,
		instrument,
		side,
		size: sizeByQuote,
		leverage: parseAmount(leverage),
		sizeDistribution,
		priceInfo: [lowerPriceInfo, upperPriceInfo],
	});

	// Place the batch order
	return await ctx.perp.instrument.batchPlaceLimitOrder(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			ticks: result.orders.map((order) => order?.tick),
			ratios: result.orders.map((order) => order?.ratio),
			baseSize: result.size.base,
			side,
			leverage: parseAmount(leverage),
			deadline: Math.floor(Date.now() / 1000) + 300,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Cancel all limit orders for a specific instrument
 * @param instrumentSymbol - The symbol of the instrument
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function cancelAllLimitOrders(
	instrumentSymbol: string,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)

	// Get the portfolio to find all active orders
	const portfolio = await getPortfolio(
		signer.address,
		instrument.instrumentAddr,
		expiry,
	);

	// Extract the ticks of all orders
	const orders = Array.from(portfolio.orders.values());
	if (orders.length === 0) {
		throw new Error("No orders to cancel");
	}

	const ticks = orders.map((order) => order.tick);

	// Cancel all orders in a batch
	return await ctx.perp.instrument.batchCancelLimitOrder(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			orderTicks: ticks,
			deadline: Math.floor(Date.now() / 1000) + 300,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Adjust the leverage of an existing position
 * @param instrumentSymbol - The symbol of the instrument
 * @param newLeverage - The new leverage to set as a string
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function adjustPositionLeverage(
	instrumentSymbol: string,
	newLeverage: string,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)

	// Get the current position
	const portfolio = await getPortfolio(
		signer.address,
		instrument.instrumentAddr,
		expiry,
	);

	// Check if there's a position to adjust
	if (portfolio.position.size.eq(0)) {
		throw new Error("No position to adjust");
	}

	// Slippage set to 1%
	const slippage = 100;

	// Simulate adjusting the leverage
	const result = await ctx.perp.simulate.simulateAdjustMarginByLeverage({
		tradeInfo: portfolio.position,
		slippage,
		leverage: parseAmount(newLeverage),
	});

	// Adjust the margin to achieve the desired leverage
	return await ctx.perp.instrument.adjustMargin(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			deadline: Math.floor(Date.now() / 1000) + 300,
			transferIn: result.transferIn,
			margin: result.margin,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Adjust the margin of an existing position
 * @param instrumentSymbol - The symbol of the instrument
 * @param marginAmount - The amount of margin to add (positive) or remove (negative)
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function adjustPositionMargin(
	instrumentSymbol: string,
	marginAmount: string,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)

	// Get the current position
	const portfolio = await getPortfolio(
		signer.address,
		instrument.instrumentAddr,
		expiry,
	);

	// Check if there's a position to adjust
	if (portfolio.position.size.eq(0)) {
		throw new Error("No position to adjust");
	}

	// Slippage set to 1%
	const slippage = 100;

	// Determine if we're adding or removing margin
	const transferIn = Number.parseFloat(marginAmount) > 0;
	const absMarginAmount = Math.abs(Number.parseFloat(marginAmount)).toString();

	// Simulate adjusting the margin
	const _result = await ctx.perp.simulate.simulateAdjustMarginByMargin({
		tradeInfo: portfolio.position,
		slippage,
		transferIn,
		margin: parseAmount(absMarginAmount),
	});

	// Adjust the margin
	return await ctx.perp.instrument.adjustMargin(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			deadline: Math.floor(Date.now() / 1000) + 300,
			transferIn,
			margin: parseAmount(absMarginAmount),
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Add liquidity to a specific instrument
 * @param instrumentSymbol - The symbol of the instrument
 * @param marginAmount - The amount of margin to provide as liquidity
 * @param alphaFactor - The liquidity range factor (e.g., "1.5" means [1/1.5, 1.5]x current price)
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function addLiquidity(
	instrumentSymbol: string,
	marginAmount: string,
	alphaFactor: string,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)
	const amm = instrument.amms.get(expiry);

	if (!amm) {
		throw new Error(
			`No AMM found for ${instrumentSymbol} with expiry ${expiry}`,
		);
	}

	// Margin to add liquidity
	const margin = parseAmount(marginAmount);

	// Alpha factor for the liquidity range
	const alphaWad = parseAmount(alphaFactor);

	// Slippage set to 1%
	const slippage = 100;

	// Simulate adding liquidity
	const simulateResult = await ctx.perp.simulate.simulateAddLiquidity({
		expiry,
		instrument,
		alphaWad,
		slippage,
		margin,
	});

	// Add liquidity
	return await ctx.perp.instrument.addLiquidity(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			tickDeltaLower: simulateResult.tickDelta,
			tickDeltaUpper: simulateResult.tickDelta,
			margin,
			limitTicks: simulateResult.limitTicks,
			deadline: Math.floor(Date.now() / 1000) + 300,
			referralCode: undefined,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Remove liquidity from a specific instrument
 * @param instrumentSymbol - The symbol of the instrument
 * @param tickLower - The lower tick of the liquidity position
 * @param tickUpper - The upper tick of the liquidity position
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function removeLiquidity(
	instrumentSymbol: string,
	tickLower: number,
	tickUpper: number,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)

	// Get the portfolio to confirm the liquidity position
	const portfolio = await getPortfolio(
		signer.address,
		instrument.instrumentAddr,
		expiry,
	);

	// Slippage set to 1%
	const slippage = 100;

	// Simulate removing liquidity
	const simulateResult = await ctx.perp.simulate.simulateRemoveLiquidity({
		tradeInfo: portfolio,
		tickLower,
		tickUpper,
		slippage,
	});

	// Remove liquidity
	return await ctx.perp.instrument.removeLiquidity(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			traderAddr: signer.address,
			tickLower,
			tickUpper,
			limitTicks: simulateResult.limitTicks,
			deadline: Math.floor(Date.now() / 1000) + 300,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

/**
 * Place a cross market order (market order + limit order) for a specific instrument
 * @param instrumentSymbol - The symbol of the instrument
 * @param side - The side of the order (LONG or SHORT)
 * @param quoteAmount - The amount in quote asset to use for the order
 * @param leverage - The desired leverage as a string
 * @param tickOffset - The tick offset from the current market price for the limit order
 * @param signer - The ethers Wallet instance for signing the transaction
 * @returns The transaction receipt
 */
export async function placeCrossMarketOrder(
	instrumentSymbol: string,
	side: Side,
	quoteAmount: string,
	leverage: string,
	tickOffset: number,
	signer: ethers.Wallet,
): Promise<TransactionReceipt> {
	const instrument = await getInstrumentBySymbol(instrumentSymbol);
	const expiry = 4294967295; // PERP_EXPIRY (type(uint32).max)
	const amm = instrument.amms.get(expiry);

	if (!amm) {
		throw new Error(
			`No AMM found for ${instrumentSymbol} with expiry ${expiry}`,
		);
	}

	// Trade info
	const tradeInfo = {
		instrumentAddr: instrument.instrumentAddr,
		expiry,
		traderAddr: signer.address,
	};

	// Slippage set to 1%
	const slippage = 100;

	// Size by quote
	const sizeByQuote = {
		quote: parseAmount(quoteAmount),
	};

	// Define the PEARL_SPACING (ORDER_SPACING)
	const PEARL_SPACING = 5;

	// For cross market order, price should be in the opposite direction of the trade
	// If LONG, the limit order should be below the current price
	// If SHORT, the limit order should be above the current price
	const direction = side.toString() === "LONG" ? -1 : 1; // Convert to string for comparison
	const targetTick = utils.alignTick(
		amm.tick + direction * tickOffset,
		PEARL_SPACING,
	);

	// Simulate the cross market order
	const result = await ctx.perp.simulate.simulateCrossMarketOrder({
		tradeInfo,
		side,
		leverage: parseAmount(leverage),
		slippage,
		size: sizeByQuote,
		priceInfo: targetTick,
	});

	// Place the cross market order
	return await ctx.perp.instrument.placeCrossMarketOrder(
		{
			instrumentAddr: instrument.instrumentAddr,
			expiry,
			side,
			tradeSize: result.tradeSimulation.size.base,
			tradeMargin: result.tradeSimulation.margin,
			tradeLimitTick: result.tradeSimulation.limitTick,
			orderTick: result.orderSimulation.tick,
			orderSize: result.orderSimulation.size.base,
			orderMargin: result.orderSimulation.margin,
			deadline: Math.floor(Date.now() / 1000) + 300,
		},
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		{ signer: signer as any },
	);
}

export type { Side };
