import {
	type Action,
	type Content,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	MemoryManager,
	type State,
	elizaLogger,
} from "@elizaos/core";
import { traceResult } from "@realityspiral/plugin-instrumentation";
import {
	type Hex,
	concat,
	erc20Abi,
	getContract,
	maxUint256,
	numberToHex,
} from "viem";
import { CHAIN_EXPLORERS, ZX_MEMORY } from "../constants";
import { getWalletClient } from "../hooks.ts/useGetWalletClient";
import { Chains, type GetIndicativePriceResponse, type Quote } from "../types";
import { getPriceInquiry } from "./getIndicativePrice";
import { getQuoteObj } from "./getQuote";

export const swap: Action = {
	name: "EXECUTE_SWAP_0X",
	similes: [
		"SWAP_TOKENS_0X",
		"TOKEN_SWAP_0X",
		"TRADE_TOKENS_0X",
		"EXCHANGE_TOKENS_0X",
	],
	suppressInitialMessage: true,
	description: "Execute a token swap using 0x protocol",
	validate: async (runtime: IAgentRuntime) => {
		return (
			!!runtime.getSetting("ZERO_EX_API_KEY") &&
			!!runtime.getSetting("WALLET_PRIVATE_KEY")
		);
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
		_options: Record<string, unknown>,
		callback: HandlerCallback,
	) => {
		const latestQuote = await retrieveLatestQuote(runtime, message);
		if (!latestQuote) {
			callback({
				text: "Please provide me the details of the swap. E.g. convert 000.1 Weth to USDC on Ethereum chain",
			});
			return;
		}

		const { quote, chainId } = latestQuote;

		try {
			const client = getWalletClient(
				chainId,
				runtime.getSetting("WALLET_PRIVATE_KEY"),
			); // 1 for mainnet, or pass chainId

			// 1. Handle Permit2 signature
			let signature: Hex | undefined;
			if (quote.permit2?.eip712) {
				signature = await client.signTypedData({
					account: client.account,
					...quote.permit2.eip712,
				});

				if (signature && quote.transaction?.data) {
					const sigLengthHex = numberToHex(signature.length, {
						size: 32,
					}) as Hex;
					quote.transaction.data = concat([
						quote.transaction.data as Hex,
						sigLengthHex,
						signature,
					]);
				}
			}

			const nonce = await client.getTransactionCount({
				address: (client.account as { address: `0x${string}` }).address,
			});

			const txHash = await client.sendTransaction({
				account: client.account,
				chain: client.chain,
				gas: quote?.transaction.gas
					? BigInt(quote?.transaction.gas)
					: undefined,
				to: quote?.transaction.to as `0x${string}`,
				data: quote.transaction.data as `0x${string}`,
				value: BigInt(quote.transaction.value),
				gasPrice: quote?.transaction.gasPrice
					? BigInt(quote?.transaction.gasPrice)
					: undefined,
				nonce: nonce,
				kzg: undefined,
			});

			// Wait for transaction confirmation
			const receipt = await client.waitForTransactionReceipt({
				hash: txHash,
			});

			if (receipt.status === "success") {
				const response: Content = {
					text: `✅ Swap executed successfully!\nView on Explorer: ${CHAIN_EXPLORERS[chainId]}/tx/${txHash}`,
					content: { hash: txHash, status: "success" },
				};

				callback(response);

				traceResult(state, response);

				return true;
			}
			callback({
				text: `❌ Swap failed! Check transaction: ${CHAIN_EXPLORERS[chainId]}/tx/${txHash}`,
				content: { hash: txHash, status: "failed" },
			});
			return false;
		} catch (error) {
			elizaLogger.error("Swap execution failed:", error);
			callback({
				text: `❌ Failed to execute swap: ${error.message || error}`,
				content: { error: error.message || String(error) },
			});
			return false;
		}
	},
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "I want to swap 1 ETH for USDC",
				},
			},
			{
				user: "{{agent}}",
				content: {
					text: "Let me get you a quote for that swap.",
					action: "GET_INDICATE_PRICE_0X",
				},
			},
			{
				user: "{{user1}}",
				content: {
					text: "Get the quote for 1 ETH for USDC on Ethereum chain",
				},
			},
			{
				user: "{{agent}}",
				content: {
					text: "Let me get you the quotefor 1 ETH for USDC on Ethereum chain",
					action: "GET_QUOTE_0X",
				},
			},
			{
				user: "{{user1}}",
				content: {
					text: "execute the swap",
				},
			},
			{
				user: "{{agent}}",
				content: {
					text: "Let me execute the swap for you.",
					action: "EXECUTE_SWAP_0X",
				},
			},
		],
	],
};

export const retrieveLatestQuote = async (
	runtime: IAgentRuntime,
	message: Memory,
): Promise<Quote | null> => {
	const memoryManager = new MemoryManager({
		runtime,
		tableName: ZX_MEMORY.quote.tableName,
	});

	try {
		const memories = await memoryManager.getMemories({
			roomId: message.roomId,
			count: 1,
			start: 0,
			end: Date.now(),
		});

		if (memories?.[0]) {
			return JSON.parse(memories[0].content.text) as Quote;
		}
		return null;
	} catch (error) {
		elizaLogger.error(`Failed to retrieve quote: ${error.message}`);
		return null;
	}
};

export const tokenSwap = async (
	runtime: IAgentRuntime,
	quantity: number,
	fromCurrency: string,
	toCurrency: string,
	address: string,
	privateKey: string,
	chain: string,
) => {
	let priceInquiry = null;
	const maxRetries = 6;
	let attempt = 0;

	while (attempt < maxRetries) {
		try {
			// get indicative price
			priceInquiry = await getPriceInquiry(
				runtime,
				fromCurrency,
				quantity,
				toCurrency,
				chain,
			);
			break; // Exit loop if successful
		} catch (error) {
			attempt++;
			elizaLogger.error(
				`Error during price inquiry (attempt ${attempt}):`,
				error.message,
			);
			if (attempt >= maxRetries) {
				return null;
			}
		}
	}

	if (!priceInquiry) {
		elizaLogger.error("Price inquiry is null");
		return null;
	}

	const chainId = Chains.base;
	elizaLogger.info(`chainId ${chainId}`);
	let quote = null;
	attempt = 0;

	while (attempt < maxRetries) {
		try {
			// get latest quote
			quote = await getQuoteObj(runtime, priceInquiry, address);
			break; // Exit loop if successful
		} catch (error) {
			attempt++;
			elizaLogger.error(
				`Error during quote retrieval (attempt ${attempt}):`,
				error.message,
			);
			if (attempt >= maxRetries) {
				return null;
			}
		}
	}

	if (!quote) {
		elizaLogger.error("Quote is null");
		return null;
	}

	attempt = 0;
	while (attempt < maxRetries) {
		try {
			const client = getWalletClient(chainId, privateKey);
			// add a balance check for gas and sell token
			const enoughGasBalance = true;
			const enoughSellTokenBalance = true;
			if (!enoughGasBalance || !enoughSellTokenBalance) {
				elizaLogger.error("Not enough balance for gas or sell token");
				return null;
			}
			// Handle token approvals
			const approved = await handleTokenApprovals(
				client,
				quote,
				priceInquiry.sellTokenObject.address as `0x${string}`,
			);
			elizaLogger.info("approved ", approved);
			if (!approved) return null;

			const nonce = await client.getTransactionCount({
				address: (client.account as { address: `0x${string}` }).address,
				blockTag: "pending",
			});
			elizaLogger.info("nonce ", nonce);
			const txHash = await client.sendTransaction({
				account: client.account,
				chain: client.chain,
				// biome-ignore lint/complexity/noExtraBooleanCast: <explanation>
				gas: !!quote?.transaction.gas
					? BigInt(quote?.transaction.gas)
					: undefined,
				to: quote?.transaction.to as `0x${string}`,
				data: quote.transaction.data as `0x${string}`,
				value: BigInt(quote.transaction.value),
				// biome-ignore lint/complexity/noExtraBooleanCast: <explanation>
				gasPrice: !!quote?.transaction.gasPrice
					? BigInt(quote?.transaction.gasPrice)
					: undefined,
				nonce: nonce,
				kzg: undefined,
			});
			// Wait for transaction confirmation
			const receipt = await client.waitForTransactionReceipt({
				hash: txHash, // The transaction hash
				confirmations: 1, // Wait for at least 1 confirmation
				pollingInterval: 1000, // Poll every 1 second
				retryCount: 5, // Retry up to 5 times
				retryDelay: 2000, // Wait 2 seconds between retries
				timeout: 60000, // Timeout after 60 seconds
				onReplaced: (replacement) => {
					elizaLogger.info("Transaction was replaced:", replacement);
				},
			});

			if (receipt.status === "success") {
				elizaLogger.info(
					`✅ Swap executed successfully!\nView on Explorer: ${CHAIN_EXPLORERS[chainId]}/tx/${txHash}`,
					{ hash: txHash, status: "success" },
				);
				return txHash;
			}
			elizaLogger.error(
				`❌ Swap failed! Check transaction: ${CHAIN_EXPLORERS[chainId]}/tx/${txHash}`,
				{ hash: txHash, status: "failed" },
			);
			return null;
		} catch (error) {
			attempt++;
			elizaLogger.error(
				`Error during transaction process (attempt ${attempt}):`,
				error.message,
			);
			if (attempt >= maxRetries) {
				return null;
			}
			await new Promise((resolve) => setTimeout(resolve, 5000)); // Sleep for 5 second before retrying
		}
	}
	return null;
};

const handleTokenApprovals = async (
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	client: any,
	quote: GetIndicativePriceResponse,
	sellTokenAddress: `0x${string}` = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
): Promise<boolean> => {
	try {
		const sellTokenContract = getContract({
			address: sellTokenAddress,
			abi: erc20Abi,
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			client: client as any,
		});

		if (quote.issues.allowance !== null) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const { request } = await (sellTokenContract as any).simulate.approve([
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				(quote as any).issues.allowance.spender,
				maxUint256,
			]);

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const hash = await (sellTokenContract as any).write.approve(request.args);
			const receipt = await client.waitForTransactionReceipt({
				hash, // The transaction hash
				confirmations: 1, // Wait for at least 1 confirmation
				pollingInterval: 1000, // Poll every 1 second
				retryCount: 5, // Retry up to 5 times
				retryDelay: 2000, // Wait 2 seconds between retries
				timeout: 60000, // Timeout after 60 seconds
				onReplaced: (replacement) => {
					elizaLogger.info("Transaction was replaced:", replacement);
				},
			});
			if (receipt.status === "success") {
				elizaLogger.info("Token approval successful");
				return true;
			}
			elizaLogger.error("Token approval failed");
			return false;
		}

		return true;
	} catch (error) {
		elizaLogger.error("Error handling token approvals:", error);
		return false;
	}
};
