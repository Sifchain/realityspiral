import {
	type Action,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type State,
	composeContext,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import * as ethers from "ethers";

import {
	BITPROTOCOL_CONTRACTS,
	ERC20_ABI,
	NETWORK_CONFIG,
	PRICE_FEED_ABI,
	TOKEN_ADDRESSES,
	TROVE_MANAGER_ABI,
	UNISWAP_V2_ROUTER_ABI,
} from "../constants";
import { getPathTemplate, swapTemplate } from "../templates";
// Import types and schemas
import {
	type GetOptimalSwapPathInput,
	GetOptimalSwapPathInputSchema,
	type PriceStabilityInfo,
	type SwapInput,
	SwapInputSchema,
	type SwapPath,
	type SwapResult,
} from "../types";
import { getProviderAndSigner } from "../utils";

// --- Internal Configuration Helper --- //

interface PluginSettings {
	rpcUrl: string;
	networkId: string;
	defaultSlippage: number;
	privacyEnabled: boolean;
}

/**
 * Retrieves and validates necessary settings from the runtime.
 */
function getConfig(runtime: IAgentRuntime): PluginSettings {
	const rpcUrl =
		runtime.getSetting("BITPROTOCOL_RPC_URL") ||
		NETWORK_CONFIG.OASIS_SAPPHIRE.rpcUrl;
	const networkId =
		runtime.getSetting("BITPROTOCOL_NETWORK_ID") ||
		NETWORK_CONFIG.OASIS_SAPPHIRE.chainId.toString();
	const defaultSlippage = Number.parseFloat(
		runtime.getSetting("BITPROTOCOL_MAX_SLIPPAGE") || "0.005",
	);
	const privacyEnabled =
		runtime.getSetting("BITPROTOCOL_PRIVACY_ENABLED") !== "false";

	if (!rpcUrl) {
		throw new Error("Missing required setting: BITPROTOCOL_RPC_URL");
	}

	return {
		rpcUrl,
		networkId,
		defaultSlippage,
		privacyEnabled,
	};
}

// --- Validate Action --- //
const validate: Action["validate"] = async (runtime: IAgentRuntime) => {
	try {
		const pk =
			runtime.getSetting("WALLET_PRIVATE_KEY") ||
			process.env.WALLET_PRIVATE_KEY ||
			(runtime.getSetting("ROFL_PLUGIN_ENABLED") &&
				runtime.getSetting("ROFL_KEY_GENERATION_SEED")) ||
			(process.env.ROFL_PLUGIN_ENABLED && process.env.ROFL_KEY_GENERATION_SEED);
		return !!pk;
	} catch {
		return false;
	}
};

// --- Swap Action --- //
const handleSwap: Action["handler"] = async (
	runtime: IAgentRuntime,
	_message: Memory,
	state?: State,
	options?: unknown, // Options might be pre-filled by LLM or passed directly
	callback?: HandlerCallback,
): Promise<SwapResult> => {
	elizaLogger.info("Executing SWAP action", { options });
	elizaLogger.info("Raw message content:", _message?.content?.text);
	const config = getConfig(runtime);
	let result: SwapResult | undefined; // Define result variable

	try {
		// Use generateObject for input extraction and validation
		const context = composeContext({
			state: state ?? ({} as State),
			template: swapTemplate,
		});

		elizaLogger.info("Sending context to generateObject");

		const generated = await generateObject({
			runtime,
			context,
			schema: SwapInputSchema,
			modelClass: ModelClass.LARGE,
		});

		// Check if the object exists and is valid
		if (!generated || !generated.object) {
			elizaLogger.error("Input generation/validation failed.");
			throw new Error(
				"Invalid input for swap: Failed to generate valid parameters.",
			);
		}

		// Cast the object to the expected type after validation
		const swapInput = generated.object as SwapInput;

		const { fromTokenSymbol, toTokenSymbol, amountStr, slippage } = swapInput;
		elizaLogger.info("Final swap input:", {
			fromTokenSymbol,
			toTokenSymbol,
			amountStr,
			slippage,
		});

		// --- Initialize ethers & Signer ---
		// Use the correct network configuration
		const { provider, signer } = await getProviderAndSigner(runtime, config);

		// Get wallet address properly
		const userAddress = await signer.getAddress();
		elizaLogger.info(`Signer Address: ${userAddress}`);

		// --- Slippage ---
		const currentSlippage = slippage ?? config.defaultSlippage;
		elizaLogger.info(`Using slippage: ${currentSlippage * 100}%`);

		// --- Input Validation & Address Lookup ---
		const fromTokenAddress = TOKEN_ADDRESSES[fromTokenSymbol];
		const toTokenAddress = TOKEN_ADDRESSES[toTokenSymbol];
		if (!fromTokenAddress || !toTokenAddress) {
			throw new Error(
				`Unsupported token symbol(s): ${fromTokenSymbol}, ${toTokenAddress}`,
			);
		}

		// --- Amount Parsing ---
		let amountParsed: bigint;
		let fromTokenDecimals: number | bigint = 18;
		let fromTokenContract: ethers.Contract | undefined;

		if (fromTokenSymbol === "ROSE") {
			amountParsed = ethers.parseEther(amountStr);
			fromTokenDecimals = 18;
		} else {
			fromTokenContract = new ethers.Contract(
				fromTokenAddress,
				ERC20_ABI,
				provider, // Connect to provider for reads
			);
			const decimalsBigInt = await fromTokenContract.decimals();
			fromTokenDecimals = Number(decimalsBigInt);
			amountParsed = ethers.parseUnits(amountStr, fromTokenDecimals);
		}
		elizaLogger.info(`Parsed amount: ${amountParsed.toString()} wei`);

		// --- Determine swap path ---
		const path = [fromTokenAddress, toTokenAddress];
		if (
			fromTokenSymbol !== "BitUSD" &&
			toTokenSymbol !== "BitUSD" &&
			fromTokenSymbol !== "ROSE" &&
			toTokenSymbol !== "ROSE"
		) {
			path.splice(1, 0, TOKEN_ADDRESSES.BitUSD);
		}
		elizaLogger.info(
			`Using swap path: ${path.map((addr) => Object.keys(TOKEN_ADDRESSES).find((key) => TOKEN_ADDRESSES[key].toLowerCase() === addr.toLowerCase()) || addr).join(" -> ")}`,
		); // Log symbols, case-insensitive

		// --- Initialize Router Contract ---
		const routerContract: ethers.Contract = new ethers.Contract(
			BITPROTOCOL_CONTRACTS.Router,
			UNISWAP_V2_ROUTER_ABI,
			signer, // Default connection to signer for transactions
		);

		// --- Get estimated output amount ---
		let estimatedOutput: bigint = BigInt(0);
		let toTokenDecimals: number | bigint = 18;
		let formattedOutput = "N/A (Estimation Failed)";
		try {
			// Use router connected to provider for read-only call
			const amountsOut = await (
				routerContract.connect(provider) as ethers.Contract
			).getAmountsOut(amountParsed, path);
			estimatedOutput = BigInt(amountsOut[amountsOut.length - 1].toString());

			// Get decimals for the 'to' token
			if (toTokenSymbol === "ROSE") {
				toTokenDecimals = 18;
			} else {
				const toTokenContract = new ethers.Contract(
					toTokenAddress,
					ERC20_ABI,
					provider,
				);
				const decimalsBigInt = await toTokenContract.decimals();
				toTokenDecimals = Number(decimalsBigInt);
			}

			formattedOutput = ethers.formatUnits(estimatedOutput, toTokenDecimals);
			elizaLogger.info(`Estimated output: ${formattedOutput} ${toTokenSymbol}`);
		} catch (error) {
			elizaLogger.warn(
				`Could not estimate output: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Attempt to get decimals anyway if possible for fallback result formatting
			try {
				if (toTokenSymbol === "ROSE") {
					toTokenDecimals = 18;
				} else {
					const toTokenContract = new ethers.Contract(
						toTokenAddress,
						ERC20_ABI,
						provider,
					);
					const decimalsBigInt = await toTokenContract.decimals();
					toTokenDecimals = Number(decimalsBigInt);
				}
			} catch {
				elizaLogger.warn(`Could not get decimals for ${toTokenSymbol}`);
			}
		}

		// Calculate minimum output using BigInt arithmetic
		const slippageBigInt = BigInt(Math.floor(currentSlippage * 10000));
		const minOutput =
			estimatedOutput - (estimatedOutput * slippageBigInt) / BigInt(10000);
		elizaLogger.info(
			`Minimum output: ${ethers.formatUnits(minOutput, toTokenDecimals)} ${toTokenSymbol}`,
		);

		// --- Execute the swap ---
		const deadline = Math.floor(Date.now() / 1000) + 3600;
		let txHash: string | undefined;
		let txResponse: ethers.TransactionResponse | undefined;

		if (fromTokenSymbol === "ROSE") {
			// Case 1: From ROSE (Native Token) to Token
			elizaLogger.info(
				`Swapping ROSE to ${toTokenSymbol} using swapExactETHForTokens amount ${minOutput.toString()} value ${amountParsed.toString()}`,
			);
			txResponse = await routerContract.swapExactETHForTokens(
				minOutput.toString(),
				path,
				userAddress,
				deadline,
				{ value: amountParsed },
			);
		} else {
			// Case 2: From Token to Token (or Token to ROSE)
			elizaLogger.info("Approving token spend...");
			if (!fromTokenContract) {
				throw new Error("From token contract not initialized");
			}
			const fromTokenSignerContract = fromTokenContract.connect(
				signer,
			) as ethers.Contract; // Cast to Contract
			const approveTx = await fromTokenSignerContract.approve(
				BITPROTOCOL_CONTRACTS.Router,
				amountParsed,
			);
			await approveTx.wait();
			elizaLogger.info(`Approval transaction confirmed: ${approveTx.hash}`);

			if (toTokenSymbol === "ROSE") {
				// Subcase: Token to ROSE (Native Token)
				elizaLogger.info(
					`Swapping ${fromTokenSymbol} to ROSE using swapExactTokensForETH amount ${amountParsed.toString()}`,
				);
				txResponse = await routerContract.swapExactTokensForETH(
					amountParsed,
					minOutput.toString(),
					path,
					userAddress,
					deadline,
				);
			} else {
				// Subcase: Token to Token
				elizaLogger.info(
					`Swapping ${fromTokenSymbol} to ${toTokenSymbol} using swapExactTokensForTokens amount ${amountParsed.toString()}`,
				);
				txResponse = await routerContract.swapExactTokensForTokens(
					amountParsed,
					minOutput.toString(),
					path,
					userAddress,
					deadline,
				);
			}
		}

		if (!txResponse) {
			throw new Error("Swap transaction was not initiated.");
		}

		txHash = txResponse.hash;
		elizaLogger.info(`Swap transaction sent: ${txHash}`);
		if (callback) {
			callback({
				text: `Swap initiated for ${amountStr} ${fromTokenSymbol} to ${toTokenSymbol}. Waiting for confirmation... Tx: ${txHash}`,
				intermediate: true,
			});
		}

		// Wait for transaction confirmation
		const txReceipt: ethers.TransactionReceipt | null = await txResponse.wait();

		if (!txReceipt || txReceipt.status !== 1) {
			throw new Error(
				`Swap transaction failed or was reverted. Tx Hash: ${txHash}`,
			);
		}

		elizaLogger.info(
			`Swap transaction confirmed. Block: ${txReceipt.blockNumber}`,
		);

		// --- Construct Result ---
		const formattedEstimatedOutput = ethers.formatUnits(
			estimatedOutput,
			toTokenDecimals,
		);
		const fromAmountFormatted = ethers.formatUnits(
			amountParsed,
			fromTokenDecimals,
		); // Format input amount
		const symbolPath = path.map(
			(addr: string) =>
				Object.keys(TOKEN_ADDRESSES).find(
					(key) => TOKEN_ADDRESSES[key].toLowerCase() === addr.toLowerCase(),
				) || addr,
		);

		result = {
			transactionHash: txHash,
			fromAmountFormatted: fromAmountFormatted,
			estimatedOutputFormatted: formattedEstimatedOutput,
			path: symbolPath,
		};

		if (callback) {
			callback({
				text: `Swap successful: ${amountStr} ${fromTokenSymbol} swapped for approx ${formattedEstimatedOutput} ${toTokenSymbol}. Tx: ${txHash}`,
			});
		}

		elizaLogger.info("Swap action completed successfully", result);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		elizaLogger.error(`Swap action failed: ${errorMessage}`, { error });
		if (callback) {
			callback({
				text: `Swap failed: ${errorMessage}`,
				error: true,
			});
		}
		throw error; // Re-throw error for runtime handling
	}

	if (!result) {
		// This should ideally not be reached if error handling is correct
		throw new Error(
			"Swap handler finished unexpectedly without a result or error.",
		);
	}
	return result;
};

export const swapAction: Action = {
	name: "BITPROTOCOL_SWAP", // Changed to uppercase convention if preferred
	description:
		"Swaps one token for another using the BitProtocol DEX (UniswapV2 fork).",
	handler: handleSwap,
	// inputSchema: SwapInputSchema, // Removed as generateObject handles validation
	similes: [
		// Added similes from previous version
		"BITPROTOCOL_SWAP_TOKENS",
		"BITPROTOCOL_EXCHANGE_ASSETS",
		"BITPROTOCOL_TRADE_BITUSD",
		"BITPROTOCOL_STABLECOIN_SWAP",
	],
	examples: [
		// Added examples from previous version
		[
			{
				user: "{{user1}}",
				content: { text: "BitProtocol Swap 0.01 ROSE for BitUSD" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Initiating BitProtocol swap for 0.01 ROSE to BitUSD...",
					action: "BITPROTOCOL_SWAP",
				},
			},
		],
		[
			{
				user: "{{user1}}",
				content: {
					text: "BitProtocol trade 0.5 BitUSD for wstROSE with 0.5% slippage",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Okay, BitProtocol swapping 0.5 BitUSD for wstROSE with 0.5% slippage limit.",
					action: "BITPROTOCOL_SWAP",
				},
			},
		],
	],
	validate,
};

// --- Monitor Price Stability Action --- //
const handleMonitorPriceStability: Action["handler"] = async (
	runtime: IAgentRuntime,
	_message: Memory,
	_state?: State,
	_options?: unknown,
	callback?: HandlerCallback,
): Promise<PriceStabilityInfo> => {
	elizaLogger.info("Executing BITPROTOCOL_MONITOR_PRICE action");
	const config = getConfig(runtime);

	try {
		// --- Initialize ethers ---
		const provider = new ethers.JsonRpcProvider(config.rpcUrl);

		// --- Contract Interaction: Use PriceFeed --- //
		elizaLogger.info("Fetching price from PriceFeed contract...");

		// Initialize PriceFeed contract
		const priceFeedContract = new ethers.Contract(
			BITPROTOCOL_CONTRACTS.PriceFeed,
			PRICE_FEED_ABI,
			provider,
		);

		// Get ROSE token address
		const ROSEAddress = TOKEN_ADDRESSES.ROSE;
		if (!ROSEAddress) {
			throw new Error("ROSE token address not found in TOKEN_ADDRESSES");
		}

		// Call the loadPrice function with ROSE token address
		elizaLogger.info(`Calling loadPrice function for ROSE (${ROSEAddress})`);
		let priceBigInt: bigint;

		try {
			// Using loadPrice (view function) instead of fetchPrice (state-changing) for monitoring ROSE price
			priceBigInt = await priceFeedContract.loadPrice(ROSEAddress);
			elizaLogger.info(`Retrieved raw price data: ${priceBigInt.toString()}`);
		} catch (error) {
			elizaLogger.error(
				`Failed to get price from PriceFeed: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new Error(
				"Could not retrieve price data from the PriceFeed contract",
			);
		}

		// Format the price (assuming 18 decimals for USD price)
		const priceString = ethers.formatUnits(priceBigInt, 18);
		elizaLogger.info(`Current ROSE price: $${priceString}`);

		// --- Stability Logic --- //
		// ROSE price is checked for deviation from expected range
		const priceNum = Number.parseFloat(priceString);
		const lowerBound = 0.98; // 2% deviation threshold
		const upperBound = 1.02;
		const isStable = priceNum >= lowerBound && priceNum <= upperBound;

		elizaLogger.info(`Stability check: Price of ROSE is $${priceString}`);

		const result: PriceStabilityInfo = {
			price: priceString,
			isStable: isStable,
			timestamp: Math.floor(Date.now() / 1000),
		};

		if (callback) {
			callback({
				text: `ROSE price: $${priceString}.`,
			});
		}
		return result;
	} catch (error: unknown) {
		elizaLogger.error(
			`bitProtocol.monitorPriceStability action failed: ${error instanceof Error ? error.message : String(error)}`,
			{ error: error instanceof Error ? error?.stack : error },
		);
		if (callback) {
			callback({
				text: `Price check failed: ${error instanceof Error ? error.message : String(error)}`,
				error: true,
			});
		}
		throw error;
	}
};

export const monitorPriceStabilityAction: Action = {
	name: "BITPROTOCOL_MONITOR_PRICE",
	description: "Monitors BitProtocol stablecoin price and stability status.",
	handler: handleMonitorPriceStability,
	similes: [
		"BITPROTOCOL_CHECK_PRICE",
		"BITPROTOCOL_MONITOR_STABILITY",
		"BITPROTOCOL_CHECK_PEG",
		"BITPROTOCOL_CHECK_BITUSD",
		"BITPROTOCOL_MONITOR_BITPROTOCOL",
	],
	examples: [
		[
			{
				user: "{{user1}}",
				content: { text: "Is BitUSD stable right now?" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Let me check the BitUSD price stability for you...",
					action: "BITPROTOCOL_CHECK_PRICE",
				},
			},
		],
	],
	validate,
};
// --- Get Optimal Swap Path Action --- //

const handleGetOptimalPath: Action["handler"] = async (
	runtime: IAgentRuntime,
	_message: Memory,
	state?: State,
	options?: unknown,
	callback?: HandlerCallback,
): Promise<SwapPath> => {
	elizaLogger.info("Executing GET_OPTIMAL_PATH action", {
		options,
		messageContent: _message?.content?.text, // Log the input message
	});
	const config = getConfig(runtime);
	let resultPath: SwapPath | undefined;

	try {
		let fromTokenSymbol: string | undefined;
		let toTokenSymbol: string | undefined;
		let amountStr = "1"; // Default amount for path finding if not specified

		// --- Parameter Extraction using generateObject with specific template ---
		elizaLogger.info(
			"Attempting parameter extraction via generateObject with getPathTemplate",
		);
		const context = composeContext({
			state: state ?? ({} as State),
			template: getPathTemplate, // Use the specific template
		});
		const generated = await generateObject({
			runtime,
			context,
			schema: GetOptimalSwapPathInputSchema,
			modelClass: ModelClass.LARGE, // Use LARGE for better extraction
		});

		if (generated?.object) {
			const pathInput = generated.object as GetOptimalSwapPathInput;
			elizaLogger.info("generateObject extracted:", pathInput);
			fromTokenSymbol = pathInput.fromTokenSymbol;
			toTokenSymbol = pathInput.toTokenSymbol;
			// Use extracted amount only if it's valid, otherwise keep default
			if (
				pathInput.amountStr &&
				!Number.isNaN(Number.parseFloat(pathInput.amountStr)) &&
				Number.parseFloat(pathInput.amountStr) > 0
			) {
				amountStr = pathInput.amountStr;
			} else {
				elizaLogger.warn(
					`generateObject provided invalid or zero amount (${pathInput.amountStr}), using default: ${amountStr}`,
				);
			}
		} else {
			elizaLogger.error(
				"generateObject failed to extract parameters. Trying to parse from text.",
			);
			// Fallback: Try simple text parsing if generateObject fails
			const messageText = _message?.content?.text || "";
			const pattern =
				/(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+(?:to|for)\s+([a-zA-Z]+)/i;
			const match = messageText.match(pattern);
			if (match) {
				amountStr = match[1];
				fromTokenSymbol = match[2];
				toTokenSymbol = match[3];
				elizaLogger.info(
					`Fallback text parse matched: ${amountStr} ${fromTokenSymbol} to ${toTokenSymbol}`,
				);
			} else {
				elizaLogger.error(
					"Fallback text parsing also failed. Cannot determine parameters.",
				);
				throw new Error(
					"Could not determine swap parameters from your request.",
				);
			}
		}

		// Final Validation (ensure tokens are valid)
		if (!fromTokenSymbol || !TOKEN_ADDRESSES[fromTokenSymbol]) {
			throw new Error(`Invalid or missing 'from' token: ${fromTokenSymbol}`);
		}
		if (!toTokenSymbol || !TOKEN_ADDRESSES[toTokenSymbol]) {
			throw new Error(`Invalid or missing 'to' token: ${toTokenSymbol}`);
		}

		elizaLogger.info("Final parameters determined:", {
			fromTokenSymbol,
			toTokenSymbol,
			amountStr,
		});

		// --- Initialize ethers ---
		const provider = new ethers.JsonRpcProvider(config.rpcUrl);

		// --- Input Validation & Address Lookup ---
		const fromTokenAddress = TOKEN_ADDRESSES[fromTokenSymbol];
		const toTokenAddress = TOKEN_ADDRESSES[toTokenSymbol];
		// Already validated symbols above, address lookup should be safe

		// --- Amount Parsing ---
		let amountParsed: bigint;
		let fromTokenDecimals: number | bigint = 18;

		try {
			if (fromTokenSymbol === "ROSE") {
				amountParsed = ethers.parseEther(amountStr);
				fromTokenDecimals = 18;
			} else {
				const tokenContract = new ethers.Contract(
					fromTokenAddress,
					ERC20_ABI,
					provider,
				);
				const decimalsBigInt = await tokenContract.decimals();
				fromTokenDecimals = Number(decimalsBigInt);
				amountParsed = ethers.parseUnits(amountStr, fromTokenDecimals);
			}
			elizaLogger.info(
				`Parsed amount: ${amountParsed.toString()} wei (${amountStr} ${fromTokenSymbol})`,
			);
		} catch (parseError) {
			elizaLogger.error(
				`Error parsing amount ${amountStr} for token ${fromTokenSymbol}: ${parseError}`,
			);
			throw new Error(`Invalid amount format: ${amountStr}`);
		}

		// --- Path & Estimation (Using Public Router) ---
		elizaLogger.info(
			"Calculating path and estimating output using public router...",
		);

		// Construct the path, ensuring no duplicates
		const path = [fromTokenAddress, toTokenAddress];

		// Only add BitUSD as intermediate if needed and it's not already in the path
		if (
			fromTokenSymbol !== "BitUSD" &&
			toTokenSymbol !== "BitUSD" &&
			fromTokenSymbol !== "ROSE" &&
			toTokenSymbol !== "ROSE"
		) {
			const bitUsdAddress = TOKEN_ADDRESSES.BitUSD;
			path.splice(1, 0, bitUsdAddress);
			elizaLogger.info("Added BitUSD as intermediate token in the path");
		}

		// Verify the path has no duplicates
		const uniqueAddresses = new Set(path);
		if (uniqueAddresses.size !== path.length) {
			elizaLogger.warn("Duplicate tokens detected in path, fixing...");
			// Use only unique addresses
			const uniquePath = Array.from(uniqueAddresses);

			// Ensure the path starts with fromTokenAddress and ends with toTokenAddress
			if (uniquePath[0] !== fromTokenAddress) {
				uniquePath.unshift(fromTokenAddress);
			}
			if (uniquePath[uniquePath.length - 1] !== toTokenAddress) {
				uniquePath.push(toTokenAddress);
			}

			// Update path with corrected unique addresses
			path.length = 0;
			path.push(...uniquePath);
		}

		// Log the final path
		elizaLogger.info(
			`Using swap path: ${path
				.map(
					(addr) =>
						Object.keys(TOKEN_ADDRESSES).find(
							(key) =>
								TOKEN_ADDRESSES[key].toLowerCase() === addr.toLowerCase(),
						) || addr,
				)
				.join(" → ")}`,
		);

		let estimatedOutput: bigint = BigInt(0);
		let toTokenDecimals: number | bigint = 18;
		let formattedOutput = "N/A (Estimation Failed)";

		try {
			// Explicitly type contract
			const routerContract: ethers.Contract = new ethers.Contract(
				BITPROTOCOL_CONTRACTS.Router,
				UNISWAP_V2_ROUTER_ABI,
				provider,
			);

			elizaLogger.info(
				`Calling getAmountsOut with amount: ${amountParsed.toString()}`,
			);

			const amountsOut = await routerContract.getAmountsOut(amountParsed, path);

			if (amountsOut && amountsOut.length > 0) {
				estimatedOutput = BigInt(amountsOut[amountsOut.length - 1].toString());

				// Get 'to' token decimals for formatting
				if (toTokenSymbol === "ROSE") {
					toTokenDecimals = 18;
				} else {
					const toTokenContract = new ethers.Contract(
						toTokenAddress,
						ERC20_ABI,
						provider,
					);
					const decimalsBigInt = await toTokenContract.decimals();
					toTokenDecimals = Number(decimalsBigInt);
				}

				formattedOutput = ethers.formatUnits(estimatedOutput, toTokenDecimals);
				elizaLogger.info(
					`Estimated output for path: ${formattedOutput} ${toTokenSymbol}`,
				);
			} else {
				elizaLogger.warn("getAmountsOut returned empty or invalid result");
			}
		} catch (error) {
			elizaLogger.warn(
				`Could not estimate output for path calculation: ${error instanceof Error ? error.message : String(error)}`,
			);
			elizaLogger.info("Attempting alternate estimation method...");

			try {
				// Alternative: If direct swap estimation fails, try estimating through individual pairs
				let running = amountParsed;
				for (let i = 0; i < path.length - 1; i++) {
					try {
						const pairPath = [path[i], path[i + 1]];
						const routerContract = new ethers.Contract(
							BITPROTOCOL_CONTRACTS.Router,
							UNISWAP_V2_ROUTER_ABI,
							provider,
						);
						const step = await routerContract.getAmountsOut(running, pairPath);
						if (step && step.length > 1) {
							running = BigInt(step[1].toString());
						}
					} catch (stepError) {
						elizaLogger.warn(`Step ${i} estimation failed: ${stepError}`);
						// Continue with current running amount
					}
				}

				if (running > amountParsed) {
					// Simple check if estimation produced a positive result
					estimatedOutput = running;
					// Re-fetch 'to' token decimals if needed for formatting alternate result
					if (toTokenSymbol === "ROSE") {
						toTokenDecimals = 18;
					} else if (toTokenDecimals === 18) {
						// Only fetch if not already fetched
						try {
							const toTokenContract = new ethers.Contract(
								toTokenAddress,
								ERC20_ABI,
								provider,
							);
							const decimalsBigInt = await toTokenContract.decimals();
							toTokenDecimals = Number(decimalsBigInt);
						} catch (decError) {
							elizaLogger.warn(
								`Failed to get 'to' token decimals for alternate formatting: ${decError}`,
							);
						}
					}

					formattedOutput = ethers.formatUnits(
						estimatedOutput,
						toTokenDecimals,
					);
					elizaLogger.info(
						`Alternate estimation method result: ${formattedOutput} ${toTokenSymbol}`,
					);
				} else {
					elizaLogger.warn(
						"Alternate estimation method did not yield a positive result.",
					);
				}
			} catch (alternateError) {
				elizaLogger.warn(`Alternate estimation also failed: ${alternateError}`);
			}
		}

		// Convert addresses in path to token symbols for better readability
		const symbolPath = path.map(
			(addr: string) =>
				Object.keys(TOKEN_ADDRESSES).find(
					(key) => TOKEN_ADDRESSES[key].toLowerCase() === addr.toLowerCase(),
				) || addr,
		);

		resultPath = {
			path: symbolPath,
			estimatedOutput: estimatedOutput.toString(),
			formattedOutput: formattedOutput,
			inputAmount: amountStr,
			fromSymbol: fromTokenSymbol,
			toSymbol: toTokenSymbol,
		};

		if (callback) {
			callback({
				text: `Optimal path: ${symbolPath.join(" → ")}`,
			});
		}
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		elizaLogger.error(
			`bitProtocol.getOptimalPath action failed: ${errorMessage}`,
			{ error: error instanceof Error ? error?.stack : error },
		);
		if (callback) {
			callback({
				text: `Failed to calculate optimal path: ${errorMessage}`,
				error: true, // Indicate error
			});
		}
		throw error; // Re-throw error
	}

	if (!resultPath) {
		throw new Error(
			"Path calculation finished unexpectedly without result or error.",
		);
	}
	return resultPath;
};

export const getOptimalPathAction: Action = {
	name: "BITPROTOCOL_GET_OPTIMAL_PATH",
	description:
		"Calculates the optimal swap path and estimates output between tokens on BitProtocol using the public router.", // Updated description
	handler: handleGetOptimalPath,
	// inputSchema: GetOptimalSwapPathInputSchema, // Removed
	similes: [
		"BITPROTOCOL_FIND_BEST_PATH",
		"BITPROTOCOL_CALCULATE_SWAP_ROUTE",
		"BITPROTOCOL_GET_EXCHANGE_PATH",
		"BITPROTOCOL_ESTIMATE_SWAP_OUTPUT",
	], // Added simile
	examples: [
		[
			{
				user: "{{user1}}",
				content: { text: "What's the best way to swap 0.01 ROSE to BitUSD?" },
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Let me calculate the optimal path for swapping 0.01 ROSE to BitUSD...",
					action: "BITPROTOCOL_GET_OPTIMAL_PATH",
				},
			},
		],
	],
	validate,
};
