import { BigNumber } from "@ethersproject/bignumber";
import { Protocol } from "@uniswap/router-sdk";
import {
	type ChainId,
	type Currency,
	CurrencyAmount,
	Token,
	TradeType,
} from "@uniswap/sdk-core";
import type { Pair } from "@uniswap/v2-sdk/dist/entities";
import { FeeAmount, type Pool } from "@uniswap/v3-sdk";
import JSBI from "jsbi";
import _ from "lodash";

import type { IV2PoolProvider } from "../providers";
import type { IPortionProvider } from "../providers/portion-provider";
import type { ProviderConfig } from "../providers/provider";
import type { IV3PoolProvider } from "../providers/v3/pool-provider";
import {
	type MethodParameters,
	MixedRouteWithValidQuote,
	type SwapOptions,
	type SwapRoute,
	usdGasTokensByChain,
	V2RouteWithValidQuote,
	V3RouteWithValidQuote,
} from "../routers";
import { log, WRAPPED_NATIVE_CURRENCY } from "../util";

import { buildTrade } from "./methodParameters";

export async function getV2NativePool(
	token: Token,
	poolProvider: IV2PoolProvider,
	providerConfig?: ProviderConfig,
): Promise<Pair | null> {
	const chainId = token.chainId as ChainId;
	const weth = WRAPPED_NATIVE_CURRENCY[chainId]!;

	const poolAccessor = await poolProvider.getPools(
		[[weth, token]],
		providerConfig,
	);
	const pool = poolAccessor.getPool(weth, token);

	if (!pool || pool.reserve0.equalTo(0) || pool.reserve1.equalTo(0)) {
		log.error(
			{
				weth,
				token,
				reserve0: pool?.reserve0.toExact(),
				reserve1: pool?.reserve1.toExact(),
			},
			`Could not find a valid WETH V2 pool with ${token.symbol} for computing gas costs.`,
		);

		return null;
	}

	return pool;
}

export async function getHighestLiquidityV3NativePool(
	token: Token,
	poolProvider: IV3PoolProvider,
	providerConfig?: ProviderConfig,
): Promise<Pool | null> {
	const nativeCurrency = WRAPPED_NATIVE_CURRENCY[token.chainId as ChainId]!;

	const nativePools = _([
		FeeAmount.HIGH,
		FeeAmount.MEDIUM,
		FeeAmount.LOW,
		FeeAmount.LOWEST,
	])
		.map<[Token, Token, FeeAmount]>((feeAmount) => {
			return [nativeCurrency, token, feeAmount];
		})
		.value();

	const poolAccessor = await poolProvider.getPools(nativePools, providerConfig);

	const pools = _([
		FeeAmount.HIGH,
		FeeAmount.MEDIUM,
		FeeAmount.LOW,
		FeeAmount.LOWEST,
	])
		.map((feeAmount) => {
			return poolAccessor.getPool(nativeCurrency, token, feeAmount);
		})
		.compact()
		.value();

	if (pools.length == 0) {
		log.error(
			{ pools },
			`Could not find a ${nativeCurrency.symbol} pool with ${token.symbol} for computing gas costs.`,
		);

		return null;
	}

	const maxPool = pools.reduce((prev, current) => {
		return JSBI.greaterThan(prev.liquidity, current.liquidity) ? prev : current;
	});

	return maxPool;
}

export async function getHighestLiquidityV3USDPool(
	chainId: ChainId,
	poolProvider: IV3PoolProvider,
	providerConfig?: ProviderConfig,
): Promise<Pool> {
	const usdTokens = usdGasTokensByChain[chainId];
	const wrappedCurrency = WRAPPED_NATIVE_CURRENCY[chainId]!;

	if (!usdTokens) {
		throw new Error(
			`Could not find a USD token for computing gas costs on ${chainId}`,
		);
	}

	const usdPools = _([
		FeeAmount.HIGH,
		FeeAmount.MEDIUM,
		FeeAmount.LOW,
		FeeAmount.LOWEST,
	])
		.flatMap((feeAmount) => {
			return _.map<Token, [Token, Token, FeeAmount]>(usdTokens, (usdToken) => [
				wrappedCurrency,
				usdToken,
				feeAmount,
			]);
		})
		.value();

	const poolAccessor = await poolProvider.getPools(usdPools, providerConfig);

	const pools = _([
		FeeAmount.HIGH,
		FeeAmount.MEDIUM,
		FeeAmount.LOW,
		FeeAmount.LOWEST,
	])
		.flatMap((feeAmount) => {
			const pools = [];

			for (const usdToken of usdTokens) {
				const pool = poolAccessor.getPool(wrappedCurrency, usdToken, feeAmount);
				if (pool) {
					pools.push(pool);
				}
			}

			return pools;
		})
		.compact()
		.value();

	if (pools.length == 0) {
		const message = `Could not find a USD/${wrappedCurrency.symbol} pool for computing gas costs.`;
		log.error({ pools }, message);
		throw new Error(message);
	}

	const maxPool = pools.reduce((prev, current) => {
		return JSBI.greaterThan(prev.liquidity, current.liquidity) ? prev : current;
	});

	return maxPool;
}

export function getGasCostInUSD(
	usdPool: Pool,
	costNativeCurrency: CurrencyAmount<Token>,
) {
	const nativeCurrency = costNativeCurrency.currency;
	// convert fee into usd
	const nativeTokenPrice =
		usdPool.token0.address == nativeCurrency.address
			? usdPool.token0Price
			: usdPool.token1Price;

	const gasCostUSD = nativeTokenPrice.quote(costNativeCurrency);
	return gasCostUSD;
}

export function getGasCostInNativeCurrency(
	nativeCurrency: Token,
	gasCostInWei: BigNumber,
) {
	// wrap fee to native currency
	const costNativeCurrency = CurrencyAmount.fromRawAmount(
		nativeCurrency,
		gasCostInWei.toString(),
	);
	return costNativeCurrency;
}

export async function getGasCostInQuoteToken(
	quoteToken: Token,
	nativePool: Pool | Pair,
	costNativeCurrency: CurrencyAmount<Token>,
) {
	const nativeTokenPrice =
		nativePool.token0.address == quoteToken.address
			? nativePool.token1Price
			: nativePool.token0Price;
	const gasCostQuoteToken = nativeTokenPrice.quote(costNativeCurrency);
	return gasCostQuoteToken;
}

export async function calculateGasUsed(
	chainId: ChainId,
	route: SwapRoute,
	simulatedGasUsed: BigNumber,
	v2PoolProvider: IV2PoolProvider,
	v3PoolProvider: IV3PoolProvider,
	providerConfig?: ProviderConfig,
) {
	const quoteToken = route.quote.currency.wrapped;
	const gasPriceWei = route.gasPriceWei;
	// calculate L2 to L1 security fee if relevant
	const l2toL1FeeInWei = BigNumber.from(0);

	// add l2 to l1 fee and wrap fee to native currency
	const gasCostInWei = gasPriceWei.mul(simulatedGasUsed).add(l2toL1FeeInWei);
	const nativeCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
	const costNativeCurrency = getGasCostInNativeCurrency(
		nativeCurrency,
		gasCostInWei,
	);

	const usdPool: Pool = await getHighestLiquidityV3USDPool(
		chainId,
		v3PoolProvider,
		providerConfig,
	);

	const gasCostUSD = await getGasCostInUSD(usdPool, costNativeCurrency);

	let gasCostQuoteToken = costNativeCurrency;
	// get fee in terms of quote token
	if (!quoteToken.equals(nativeCurrency)) {
		const nativePools = await Promise.all([
			getHighestLiquidityV3NativePool(
				quoteToken,
				v3PoolProvider,
				providerConfig,
			),
			getV2NativePool(quoteToken, v2PoolProvider, providerConfig),
		]);
		const nativePool = nativePools.find((pool) => pool !== null);

		if (!nativePool) {
			log.info(
				"Could not find any V2 or V3 pools to convert the cost into the quote token",
			);
			gasCostQuoteToken = CurrencyAmount.fromRawAmount(quoteToken, 0);
		} else {
			gasCostQuoteToken = await getGasCostInQuoteToken(
				quoteToken,
				nativePool,
				costNativeCurrency,
			);
		}
	}

	// Adjust quote for gas fees
	let quoteGasAdjusted;
	if (route.trade.tradeType == TradeType.EXACT_OUTPUT) {
		// Exact output - need more of tokenIn to get the desired amount of tokenOut
		quoteGasAdjusted = route.quote.add(gasCostQuoteToken);
	} else {
		// Exact input - can get less of tokenOut due to fees
		quoteGasAdjusted = route.quote.subtract(gasCostQuoteToken);
	}

	return {
		estimatedGasUsedUSD: gasCostUSD,
		estimatedGasUsedQuoteToken: gasCostQuoteToken,
		quoteGasAdjusted: quoteGasAdjusted,
	};
}

export function initSwapRouteFromExisting(
	swapRoute: SwapRoute,
	v2PoolProvider: IV2PoolProvider,
	v3PoolProvider: IV3PoolProvider,
	portionProvider: IPortionProvider,
	quoteGasAdjusted: CurrencyAmount<Currency>,
	estimatedGasUsed: BigNumber,
	estimatedGasUsedQuoteToken: CurrencyAmount<Currency>,
	estimatedGasUsedUSD: CurrencyAmount<Currency>,
	swapOptions: SwapOptions,
): SwapRoute {
	const currencyIn = swapRoute.trade.inputAmount.currency;
	const currencyOut = swapRoute.trade.outputAmount.currency;
	const tradeType = swapRoute.trade.tradeType.valueOf()
		? TradeType.EXACT_OUTPUT
		: TradeType.EXACT_INPUT;
	const routesWithValidQuote = swapRoute.route.map((route) => {
		switch (route.protocol) {
			case Protocol.V3:
				return new V3RouteWithValidQuote({
					amount: CurrencyAmount.fromFractionalAmount(
						route.amount.currency,
						route.amount.numerator,
						route.amount.denominator,
					),
					rawQuote: BigNumber.from(route.rawQuote),
					sqrtPriceX96AfterList: route.sqrtPriceX96AfterList.map((num) =>
						BigNumber.from(num),
					),
					initializedTicksCrossedList: [...route.initializedTicksCrossedList],
					quoterGasEstimate: BigNumber.from(route.gasEstimate),
					percent: route.percent,
					route: route.route,
					gasModel: route.gasModel,
					quoteToken: new Token(
						currencyIn.chainId,
						route.quoteToken.address,
						route.quoteToken.decimals,
						route.quoteToken.symbol,
						route.quoteToken.name,
					),
					tradeType: tradeType,
					v3PoolProvider: v3PoolProvider,
				});
			case Protocol.V2:
				return new V2RouteWithValidQuote({
					amount: CurrencyAmount.fromFractionalAmount(
						route.amount.currency,
						route.amount.numerator,
						route.amount.denominator,
					),
					rawQuote: BigNumber.from(route.rawQuote),
					percent: route.percent,
					route: route.route,
					gasModel: route.gasModel,
					quoteToken: new Token(
						currencyIn.chainId,
						route.quoteToken.address,
						route.quoteToken.decimals,
						route.quoteToken.symbol,
						route.quoteToken.name,
					),
					tradeType: tradeType,
					v2PoolProvider: v2PoolProvider,
				});
			case Protocol.MIXED:
				return new MixedRouteWithValidQuote({
					amount: CurrencyAmount.fromFractionalAmount(
						route.amount.currency,
						route.amount.numerator,
						route.amount.denominator,
					),
					rawQuote: BigNumber.from(route.rawQuote),
					sqrtPriceX96AfterList: route.sqrtPriceX96AfterList.map((num) =>
						BigNumber.from(num),
					),
					initializedTicksCrossedList: [...route.initializedTicksCrossedList],
					quoterGasEstimate: BigNumber.from(route.gasEstimate),
					percent: route.percent,
					route: route.route,
					mixedRouteGasModel: route.gasModel,
					v2PoolProvider,
					quoteToken: new Token(
						currencyIn.chainId,
						route.quoteToken.address,
						route.quoteToken.decimals,
						route.quoteToken.symbol,
						route.quoteToken.name,
					),
					tradeType: tradeType,
					v3PoolProvider: v3PoolProvider,
				});
		}
	});
	const trade = buildTrade<typeof tradeType>(
		currencyIn,
		currencyOut,
		tradeType,
		routesWithValidQuote,
	);

	const quoteGasAndPortionAdjusted = swapRoute.portionAmount
		? portionProvider.getQuoteGasAndPortionAdjusted(
				swapRoute.trade.tradeType,
				quoteGasAdjusted,
				swapRoute.portionAmount,
			)
		: undefined;
	const routesWithValidQuotePortionAdjusted =
		portionProvider.getRouteWithQuotePortionAdjusted(
			swapRoute.trade.tradeType,
			routesWithValidQuote,
			swapOptions,
		);

	return {
		quote: swapRoute.quote,
		quoteGasAdjusted,
		quoteGasAndPortionAdjusted,
		estimatedGasUsed,
		estimatedGasUsedQuoteToken,
		estimatedGasUsedUSD,
		gasPriceWei: BigNumber.from(swapRoute.gasPriceWei),
		trade,
		route: routesWithValidQuotePortionAdjusted,
		blockNumber: BigNumber.from(swapRoute.blockNumber),
		methodParameters: swapRoute.methodParameters
			? ({
					calldata: swapRoute.methodParameters.calldata,
					value: swapRoute.methodParameters.value,
					to: swapRoute.methodParameters.to,
				} as MethodParameters)
			: undefined,
		simulationStatus: swapRoute.simulationStatus,
		portionAmount: swapRoute.portionAmount,
	};
}
