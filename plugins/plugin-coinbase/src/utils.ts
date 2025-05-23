import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	Coinbase,
	type MnemonicSeedPhrase,
	type Trade,
	type Transfer,
	Wallet,
	type WalletData,
	type Webhook,
} from "@coinbase/coinbase-sdk";
import type { EthereumTransaction } from "@coinbase/coinbase-sdk/dist/client";
import { type IAgentRuntime, elizaLogger, settings } from "@elizaos/core";
import { createArrayCsvWriter } from "csv-writer";
import { ABI } from "./constants";
import { ContractHelper } from "./helpers/contractHelper";
import type { Transaction } from "./types";

const tradeCsvFilePath = path.join("/tmp", "trades.csv");
const transactionCsvFilePath = path.join("/tmp", "transactions.csv");
const webhookCsvFilePath = path.join("/tmp", "webhooks.csv");

export type WalletType =
	| "short_term_trading"
	| "long_term_trading"
	| "dry_powder"
	| "operational_capital";
export type CoinbaseWallet = { wallet: Wallet; walletType: WalletType };

// Map numeric chain IDs to Coinbase network identifiers
const NETWORK_ID_MAP: Record<string, string> = {
	// Mapping Chain IDs to Coinbase network names
	"23294": Coinbase.networks.BaseMainnet, // Oasis Sapphire mainnet -> use Base mainnet as fallback
	"23295": Coinbase.networks.BaseSepolia, // Oasis Sapphire testnet -> use Base testnet as fallback
	// Add more mappings as needed
};

// Map string network identifiers to Coinbase network identifiers
const NETWORK_NAME_MAP: Record<string, string> = {
	// Ethereum networks
	"ethereum-mainnet": Coinbase.networks.EthereumMainnet,
	eth: Coinbase.networks.EthereumMainnet,
	ethereum: Coinbase.networks.EthereumMainnet,

	// Base networks
	base: Coinbase.networks.BaseMainnet,
	"base-mainnet": Coinbase.networks.BaseMainnet,
	"base-sepolia": Coinbase.networks.BaseSepolia,
	"base-testnet": Coinbase.networks.BaseSepolia,

	// Arbitrum networks
	arbitrum: Coinbase.networks.ArbitrumMainnet,
	"arbitrum-mainnet": Coinbase.networks.ArbitrumMainnet,

	// Polygon networks
	polygon: Coinbase.networks.PolygonMainnet,
	"polygon-mainnet": Coinbase.networks.PolygonMainnet,
};

// Function to convert numeric network ID to a supported Coinbase network name
export function getSupportedNetwork(networkId: string): string {
	// Check if it's a numeric chain ID
	if (NETWORK_ID_MAP[networkId]) {
		return NETWORK_ID_MAP[networkId];
	}

	// Check if it's a string network identifier
	const normalizedId = networkId.toLowerCase();
	if (NETWORK_NAME_MAP[normalizedId]) {
		return NETWORK_NAME_MAP[normalizedId];
	}

	// Default fallback
	elizaLogger.warn(
		`No mapping found for network ID ${networkId}, defaulting to Base Sepolia testnet`,
	);
	return Coinbase.networks.BaseSepolia;
}

export async function initializeWallet(
	runtime: IAgentRuntime,
	networkId: string = Coinbase.networks.EthereumMainnet,
	walletType: WalletType = "short_term_trading",
): Promise<CoinbaseWallet> {
	let wallet: Wallet;
	let seed: string;
	let storedSeed: string;
	let walletId: string;
	// get working
	switch (walletType) {
		case "short_term_trading":
			storedSeed =
				runtime.getSetting("COINBASE_SHORT_TERM_TRADING_WALLET_SEED") ??
				process.env.COINBASE_SHORT_TERM_TRADING_WALLET_SEED;
			if (storedSeed !== null) {
				seed = storedSeed;
			}
			walletId =
				runtime.getSetting("COINBASE_SHORT_TERM_TRADING_WALLET_ID") ??
				process.env.COINBASE_SHORT_TERM_TRADING_WALLET_ID;
			break;
		case "long_term_trading":
			storedSeed =
				runtime.getSetting("COINBASE_LONG_TERM_TRADING_WALLET_SEED") ??
				process.env.COINBASE_LONG_TERM_TRADING_WALLET_SEED;
			if (storedSeed !== null) {
				seed = storedSeed;
			}
			walletId =
				runtime.getSetting("COINBASE_LONG_TERM_TRADING_WALLET_ID") ??
				process.env.COINBASE_LONG_TERM_TRADING_WALLET_ID;
			break;
		case "dry_powder":
			seed =
				runtime.getSetting("COINBASE_DRY_POWDER_WALLET_SEED") ??
				process.env.COINBASE_DRY_POWDER_WALLET_SEED;
			if (storedSeed !== null) {
				seed = storedSeed;
			}
			walletId =
				runtime.getSetting("COINBASE_DRY_POWDER_WALLET_ID") ??
				process.env.COINBASE_DRY_POWDER_WALLET_ID;
			break;
		case "operational_capital":
			seed =
				runtime.getSetting("COINBASE_OPERATIONAL_CAPITAL_WALLET_SEED") ??
				process.env.COINBASE_OPERATIONAL_CAPITAL_WALLET_SEED;
			if (storedSeed !== null) {
				seed = storedSeed;
			}
			walletId =
				runtime.getSetting("COINBASE_OPERATIONAL_CAPITAL_WALLET_ID") ??
				process.env.COINBASE_OPERATIONAL_CAPITAL_WALLET_ID;
			break;
		default:
			elizaLogger.error("Invalid wallet type provided.");
			throw new Error("Invalid wallet type");
	}

	// Convert numeric network ID to a supported network name
	const supportedNetworkId = getSupportedNetwork(networkId);
	elizaLogger.info("Using supported network for Coinbase SDK:", {
		originalNetworkId: networkId,
		supportedNetworkId: supportedNetworkId,
	});

	elizaLogger.info(
		"Importing existing wallet using stored seed and wallet ID:",
		{
			seed,
			walletId,
			walletType,
			networkId: supportedNetworkId,
		},
	);
	const sanitizedCharacterName = runtime.character.name.match(/[A-Z][a-z]+/g)
		? runtime.character.name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
		: runtime.character.name.toLowerCase();
	if (!seed || seed === "") {
		// No stored seed or wallet ID, creating a new wallet
		wallet = await Wallet.create({ networkId: supportedNetworkId });
		wallet = await Wallet.create({ networkId: supportedNetworkId });
		elizaLogger.log("Created new wallet:", wallet.getId());
		// Export wallet data directly
		const walletData: WalletData = wallet.export();
		const walletAddress = await wallet.getDefaultAddress();
		try {
			const characterFilePath = `characters/${sanitizedCharacterName}.character.json`;
			const walletIDSave = await updateCharacterSecrets(
				characterFilePath,
				`COINBASE_${walletType.toUpperCase()}_WALLET_ID`,
				walletId,
			);
			const seedSave = await updateCharacterSecrets(
				characterFilePath,
				`COINBASE_${walletType.toUpperCase()}_WALLET_SEED`,
				walletData.seed,
			);
			if (walletIDSave && seedSave) {
				elizaLogger.log("Successfully updated character secrets.");
			} else {
				const seedFilePath = `/tmp/${sanitizedCharacterName}-seed.txt`;
				elizaLogger.error(
					`Failed to update character secrets so adding gitignored ${seedFilePath} file please add it your env or character file and delete:`,
				);
				// save it to gitignored file
				wallet.saveSeedToFile(seedFilePath);
			}
			elizaLogger.log("Wallet created and stored new wallet:", walletAddress);
		} catch (error) {
			elizaLogger.error("Error updating character secrets:", error);
			throw error;
		}

		// Logging wallet creation
		elizaLogger.log("Created and stored new wallet:", walletAddress);
	} else {
		// We have a stored seed (private key) and possibly a wallet ID
		elizaLogger.info("Attempting to initialize wallet with stored credentials");

		try {
			if (walletId) {
				// If we have a wallet ID, fetch the existing wallet
				elizaLogger.info(`Fetching wallet with ID: ${walletId}`);
				wallet = await Wallet.fetch(walletId);
				elizaLogger.info("Successfully fetched wallet by ID");

				// Set the seed (private key) for signing
				if (seed) {
					elizaLogger.info("Setting seed for fetched wallet to enable signing");
					wallet.setSeed(seed);
				}
			} else {
				// No wallet ID, create a new wallet with the seed if available
				if (seed) {
					elizaLogger.info("Creating a new wallet with the provided seed");
					wallet = await Wallet.createWithSeed({
						seed: seed,
						networkId: supportedNetworkId, // Use supported network ID
					});
					elizaLogger.info("Created new wallet with provided seed");
				} else {
					// No wallet ID, no seed, create entirely new wallet
					elizaLogger.info(
						"No wallet ID or seed available, creating a brand new wallet",
					);
					wallet = await Wallet.create({
						networkId: supportedNetworkId, // Use supported network ID
					});
					elizaLogger.info("Created new wallet with random seed");
				}
				elizaLogger.info(
					"New wallet address:",
					await wallet.getDefaultAddress(),
				);
			}
		} catch (walletError) {
			elizaLogger.error("Failed to initialize wallet", {
				error:
					walletError instanceof Error
						? {
								message: walletError.message,
								stack: walletError.stack,
								name: walletError.name,
							}
						: walletError,
				walletId,
				networkId: supportedNetworkId,
			});
			// Rethrow or handle appropriately
			throw walletError;
		}

		// We have a stored seed (private key) and possibly a wallet ID
		elizaLogger.info("Attempting to initialize wallet with stored credentials");

		try {
			if (walletId) {
				// If we have a wallet ID, fetch the existing wallet
				elizaLogger.info(`Fetching wallet with ID: ${walletId}`);
				wallet = await Wallet.fetch(walletId);
				elizaLogger.info("Successfully fetched wallet by ID");

				// Set the seed (private key) for signing
				if (seed) {
					elizaLogger.info("Setting seed for fetched wallet to enable signing");
					wallet.setSeed(seed);
				}
			} else {
				// No wallet ID, create a new wallet with the seed if available
				if (seed) {
					elizaLogger.info("Creating a new wallet with the provided seed");
					wallet = await Wallet.createWithSeed({
						seed: seed,
						networkId: supportedNetworkId, // Use supported network ID
					});
					elizaLogger.info("Created new wallet with provided seed");
				} else {
					// No wallet ID, no seed, create entirely new wallet
					elizaLogger.info(
						"No wallet ID or seed available, creating a brand new wallet",
					);
					wallet = await Wallet.create({
						networkId: supportedNetworkId, // Use supported network ID
					});
					elizaLogger.info("Created new wallet with random seed");
				}
				elizaLogger.info(
					"New wallet address:",
					await wallet.getDefaultAddress(),
				);
			}
		} catch (walletError) {
			elizaLogger.error("Failed to initialize wallet", {
				error:
					walletError instanceof Error
						? {
								message: walletError.message,
								stack: walletError.stack,
								name: walletError.name,
							}
						: walletError,
				walletId,
				networkId: supportedNetworkId,
			});
			// Rethrow or handle appropriately
			throw walletError;
		}

		if (!walletId) {
			try {
				const characterFilePath = `characters/${sanitizedCharacterName}.character.json`;
				const walletIDSave = await updateCharacterSecrets(
					characterFilePath,
					`COINBASE_${walletType.toUpperCase()}_WALLET_ID`,
					walletId || wallet.getId(),
				);
				if (walletIDSave) {
					elizaLogger.log("Successfully updated character secrets.");
				}
			} catch (error) {
				elizaLogger.error("Error updating character wallet id", error);
				throw error;
			}
		}
		elizaLogger.log("Wallet initialized for network:", supportedNetworkId);
		elizaLogger.log("Wallet initialized for network:", supportedNetworkId);

		// Logging wallet info
		elizaLogger.log("Wallet address:", await wallet.getDefaultAddress());
		// Logging wallet info
		elizaLogger.log("Wallet address:", await wallet.getDefaultAddress());
	}

	return { wallet, walletType };
}

/**
 * Executes a trade and a charity transfer.
 * @param {IAgentRuntime} runtime - The runtime for wallet initialization.
 * @param {string} network - The network to use.
 * @param {number} amount - The amount to trade and transfer.
 * @param {string} sourceAsset - The source asset to trade.
 * @param {string} targetAsset - The target asset to trade.
 */
export async function executeTradeAndCharityTransfer(
	runtime: IAgentRuntime,
	network: string,
	amount: number,
	sourceAsset: string,
	targetAsset: string,
) {
	const { wallet } = await initializeWallet(runtime, network);

	elizaLogger.log("Wallet initialized:", {
		network,
		address: await wallet.getDefaultAddress(),
	});

	const charityAddress = getCharityAddress(network);
	const charityAmount = charityAddress ? amount * 0.01 : 0;
	const tradeAmount = charityAddress ? amount - charityAmount : amount;
	const assetIdLowercase = sourceAsset.toLowerCase();
	const tradeParams = {
		amount: tradeAmount,
		fromAssetId: assetIdLowercase,
		toAssetId: targetAsset.toLowerCase(),
	};

	let transfer: Transfer;
	if (charityAddress && charityAmount > 1) {
		transfer = await executeTransfer(
			wallet,
			charityAmount,
			assetIdLowercase,
			charityAddress,
		);
		elizaLogger.log("Charity Transfer successful:", {
			address: charityAddress,
			transactionUrl: transfer.getTransactionLink(),
		});
		await appendTransactionsToCsv([
			{
				address: charityAddress,
				amount: charityAmount,
				status: "Success",
				errorCode: null,
				transactionUrl: transfer.getTransactionLink(),
			},
		]);
	}

	const trade: Trade = await wallet.createTrade(tradeParams);
	elizaLogger.log("Trade initiated:", trade.toString());
	await trade.wait();
	elizaLogger.log("Trade completed successfully:", trade.toString());
	await appendTradeToCsv(trade);
	return {
		trade,
		transfer,
	};
}

export async function appendTradeToCsv(trade: Trade) {
	try {
		const csvWriter = createArrayCsvWriter({
			path: tradeCsvFilePath,
			header: [
				"Network",
				"From Amount",
				"Source Asset",
				"To Amount",
				"Target Asset",
				"Status",
				"Transaction URL",
			],
			append: true,
		});

		const formattedTrade = [
			trade.getNetworkId(),
			trade.getFromAmount(),
			trade.getFromAssetId(),
			trade.getToAmount(),
			trade.getToAssetId(),
			trade.getStatus(),
			trade.getTransaction().getTransactionLink() || "",
		];

		elizaLogger.log("Writing trade to CSV:", formattedTrade);
		await csvWriter.writeRecords([formattedTrade]);
		elizaLogger.log("Trade written to CSV successfully.");
	} catch (error) {
		elizaLogger.error("Error writing trade to CSV:", error);
	}
}

export async function appendTransactionsToCsv(transactions: Transaction[]) {
	try {
		const csvWriter = createArrayCsvWriter({
			path: transactionCsvFilePath,
			header: ["Address", "Amount", "Status", "Error Code", "Transaction URL"],
			append: true,
		});

		const formattedTransactions = transactions.map((transaction) => [
			transaction.address,
			transaction.amount.toString(),
			transaction.status,
			transaction.errorCode || "",
			transaction.transactionUrl || "",
		]);

		elizaLogger.log("Writing transactions to CSV:", formattedTransactions);
		await csvWriter.writeRecords(formattedTransactions);
		elizaLogger.log("All transactions written to CSV successfully.");
	} catch (error) {
		elizaLogger.error("Error writing transactions to CSV:", error);
	}
}
// create a function to append webhooks to a csv
export async function appendWebhooksToCsv(webhooks: Webhook[]) {
	try {
		// Ensure the CSV file exists
		if (!fs.existsSync(webhookCsvFilePath)) {
			elizaLogger.warn("CSV file not found. Creating a new one.");
			const csvWriter = createArrayCsvWriter({
				path: webhookCsvFilePath,
				header: [
					"Webhook ID",
					"Network ID",
					"Event Type",
					"Event Filters",
					"Event Type Filter",
					"Notification URI",
				],
			});
			await csvWriter.writeRecords([]); // Create an empty file with headers
			elizaLogger.log("New CSV file created with headers.");
		}
		const csvWriter = createArrayCsvWriter({
			path: webhookCsvFilePath,
			header: [
				"Webhook ID",
				"Network ID",
				"Event Type",
				"Event Filters",
				"Event Type Filter",
				"Notification URI",
			],
			append: true,
		});

		const formattedWebhooks = webhooks.map((webhook) => [
			webhook.getId(),
			webhook.getNetworkId(),
			webhook.getEventType(),
			JSON.stringify(webhook.getEventFilters()),
			JSON.stringify(webhook.getEventTypeFilter()),
			webhook.getNotificationURI(),
		]);

		elizaLogger.log("Writing webhooks to CSV:", formattedWebhooks);
		await csvWriter.writeRecords(formattedWebhooks);
		elizaLogger.log("All webhooks written to CSV successfully.");
	} catch (error) {
		elizaLogger.error("Error writing webhooks to CSV:", error);
	}
}

/**
 * Updates a key-value pair in character.settings.secrets.
 * @param {string} characterfilePath - The file path to the character.
 * @param {string} key - The secret key to update or add.
 * @param {string} value - The new value for the secret key.
 */
export async function updateCharacterSecrets(
	characterfilePath: string,
	key: string,
	value: string,
): Promise<boolean> {
	try {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		const baseDir = path.resolve(__dirname, "../../../");
		const characterFilePath = path.join(baseDir, characterfilePath);
		elizaLogger.log("Character file path:", characterFilePath);
		// Check if the character file exists
		if (!fs.existsSync(characterFilePath)) {
			elizaLogger.error("Character file not found:", characterFilePath);
			return false;
		}

		// Read the existing character file
		const characterData = JSON.parse(
			fs.readFileSync(characterFilePath, "utf-8"),
		);

		// Ensure settings and secrets exist in the character file
		if (!characterData.settings) {
			characterData.settings = {};
		}
		if (!characterData.settings.secrets) {
			characterData.settings.secrets = {};
		}

		// Update or add the key-value pair
		characterData.settings.secrets[key] = value;

		// Write the updated data back to the file
		fs.writeFileSync(
			characterFilePath,
			JSON.stringify(characterData, null, 2),
			"utf-8",
		);

		console.log(
			`Updated ${key} in character.settings.secrets for ${characterFilePath}.`,
		);
	} catch (error) {
		elizaLogger.error("Error updating character secrets:", error);
		return false;
	}
	return true;
}

export const getAssetType = (transaction: EthereumTransaction) => {
	// Check for ETH
	if (transaction.value && transaction.value !== "0") {
		return "ETH";
	}

	// Check for ERC-20 tokens
	if (transaction.token_transfers && transaction.token_transfers.length > 0) {
		return transaction.token_transfers
			.map((transfer) => {
				return transfer.token_id;
			})
			.join(", ");
	}

	return "N/A";
};

/**
 * Fetches and formats wallet balances and recent transactions.
 *
 * @param {IAgentRuntime} runtime - The runtime for wallet initialization.
 * @param {string} networkId - The network ID (optional, defaults to ETH mainnet).
 * @returns {Promise<{balances: Array<{asset: string, amount: string}>, transactions: Array<any>}>} - An object with formatted balances and transactions.
 */
export async function getWalletDetails(
	runtime: IAgentRuntime,
	networkId: string = Coinbase.networks.BaseMainnet,
): Promise<{
	balances: Array<{ asset: string; amount: string }>;
	transactions: Array<{
		timestamp: string;
		amount: string;
		asset: string; // Ensure getAssetType is implemented
		status: string;
		transactionUrl: string;
	}>;
}> {
	try {
		// Initialize the wallet, defaulting to the specified network or ETH mainnet
		const { wallet } = await initializeWallet(runtime, networkId);

		// Fetch balances
		const balances = await wallet.listBalances();
		const formattedBalances = Array.from(balances, (balance) => ({
			asset: balance[0],
			amount: balance[1].toString(),
		}));

		// Fetch the wallet's recent transactions

		const transactionsData = [];
		const formattedTransactions = transactionsData.map((transaction) => {
			const content = transaction.content();
			return {
				timestamp: content.block_timestamp || "N/A",
				amount: content.value || "N/A",
				asset: getAssetType(content) || "N/A", // Ensure getAssetType is implemented
				status: transaction.getStatus(),
				transactionUrl: transaction.getTransactionLink() || "N/A",
			};
		});

		// Return formatted data
		return {
			balances: formattedBalances,
			transactions: formattedTransactions,
		};
	} catch (error) {
		console.error("Error fetching wallet details:", error);
		throw new Error("Unable to retrieve wallet details.");
	}
}

/**
 * Executes a transfer.
 * @param {Wallet} wallet - The wallet to use.
 * @param {number} amount - The amount to transfer.
 * @param {string} sourceAsset - The source asset to transfer.
 * @param {string} targetAddress - The target address to transfer to.
 */
export async function executeTransferAndCharityTransfer(
	wallet: Wallet,
	amount: number,
	sourceAsset: string,
	targetAddress: string,
	network: string,
) {
	const charityAddress = getCharityAddress(network);
	const charityAmount = charityAddress ? amount * 0.01 : 0;
	const transferAmount = charityAddress ? amount - charityAmount : amount;
	const assetIdLowercase = sourceAsset.toLowerCase();

	let charityTransfer: Transfer;
	// biome-ignore lint/correctness/noConstantCondition: <explanation>
	if (false) {
		charityTransfer = await executeTransfer(
			wallet,
			charityAmount,
			assetIdLowercase,
			charityAddress,
		);
		elizaLogger.log("Charity Transfer successful:", charityTransfer.toString());
	}

	const transferDetails = {
		amount: transferAmount,
		assetId: assetIdLowercase,
		destination: targetAddress,
		gasless: assetIdLowercase === "usdc",
	};
	elizaLogger.log("Initiating transfer:", transferDetails);
	const transfer = await wallet.createTransfer(transferDetails);
	elizaLogger.log("Transfer initiated:", transfer.toString());
	await transfer.wait();

	let responseText = `Transfer executed successfully:
- Amount: ${transfer?.getAmount()}
- Asset: ${assetIdLowercase}
- Destination: ${targetAddress}
- Transaction URL: ${transfer?.getTransactionLink() || ""}`;

	if (charityTransfer) {
		responseText += `
- Charity Amount: ${charityTransfer?.getAmount()}
- Charity Transaction URL: ${charityTransfer?.getTransactionLink() || ""}`;
	} else {
		responseText += "\nNote: Charity transfer was not completed";
	}

	elizaLogger.log(responseText);

	return {
		transfer,
		charityTransfer,
		responseText,
	};
}

/**
 * Executes a transfer.
 * @param {Wallet} wallet - The wallet to use.
 * @param {number} amount - The amount to transfer.
 * @param {string} sourceAsset - The source asset to transfer.
 * @param {string} targetAddress - The target address to transfer to.
 */
export async function executeTransfer(
	wallet: Wallet,
	amount: number,
	sourceAsset: string,
	targetAddress: string,
) {
	const assetIdLowercase = sourceAsset.toLowerCase();
	const transferDetails = {
		amount,
		assetId: assetIdLowercase,
		destination: targetAddress,
		gasless: assetIdLowercase === "usdc",
	};
	elizaLogger.log("Initiating transfer:", transferDetails);
	let transfer: Transfer | undefined;
	try {
		transfer = await wallet.createTransfer(transferDetails);
		elizaLogger.log("Transfer initiated:", transfer.toString());
		await transfer.wait({
			intervalSeconds: 1,
			timeoutSeconds: 20,
		});
	} catch (error) {
		elizaLogger.error("Error executing transfer:", error);
	}
	return transfer;
}

/**
 * Gets the charity address based on the network.
 * @param {string} network - The network to use.
 * @param {boolean} isCharitable - Whether charity donations are enabled
 * @throws {Error} If charity address for the network is not configured when charity is enabled
 */
export function getCharityAddress(
	network: string,
	isCharitable = false,
): string | null {
	// Check both environment variable and passed parameter
	const isCharityEnabled = process.env.IS_CHARITABLE === "true" && isCharitable;

	if (!isCharityEnabled) {
		return null;
	}
	const networkKey = `CHARITY_ADDRESS_${network.toUpperCase()}`;
	const charityAddress = settings[networkKey];

	if (!charityAddress) {
		throw new Error(
			`Charity address not configured for network ${network}. Please set ${networkKey} in your environment variables.`,
		);
	}

	return charityAddress;
}

/**
 * Wrapper function to read data from a smart contract using the Coinbase SDK
 * @param params Parameters for contract reading as a single object or multiple arguments
 * @returns The serialized contract response
 */
export async function readContractWrapper(
	// biome-ignore lint/suspicious/noExplicitAny: Needed for flexibility with different contract methods
	runtimeOrParams: IAgentRuntime | any,
	contractAddress?: `0x${string}`,
	method?: string,
	// biome-ignore lint/suspicious/noExplicitAny: Needed for flexibility with different contract methods
	args?: any,
	networkId?: string,
	// biome-ignore lint/suspicious/noExplicitAny: Needed for flexibility with different contract methods
	abi?: any,
	// biome-ignore lint/suspicious/noExplicitAny: Needed for flexibility with different contract methods
): Promise<any> {
	// biome-ignore lint/suspicious/noExplicitAny: Needed for flexibility with different contract methods
	let params: any;
	let runtime: IAgentRuntime;

	// Handle both object-style and multi-argument calls
	if (contractAddress && method) {
		// Multi-argument form
		runtime = runtimeOrParams as IAgentRuntime;
		elizaLogger.debug(
			"readContractWrapper (multi-arg): Preparing params using ContractHelper",
		);
		params = {
			contractAddress,
			method,
			args,
			networkId,
			abi: abi || ABI, // Pass ABI along
		};
	} else {
		// Object form
		params = runtimeOrParams;
		if (!params.runtime) {
			elizaLogger.error(
				"readContractWrapper (object-arg): Missing 'runtime' property in params object.",
			);
			throw new Error(
				"The 'runtime' object must be provided within the params when calling readContractWrapper in object form.",
			);
		}
		runtime = params.runtime;
		elizaLogger.debug(
			"readContractWrapper (object-arg): Preparing params using ContractHelper",
		);
		// Ensure ABI is included if not present
		if (!params.abi) {
			params.abi = ABI;
		}
	}

	try {
		// Always use ContractHelper which handles configuration
		const contractHelper = new ContractHelper(runtime);
		elizaLogger.debug(
			"Attempting to read contract via ContractHelper with params:",
			JSON.stringify(params, null, 2),
		);
		// Pass the entire params object to the helper's method
		const result = await contractHelper.readContract(params);

		// No need to serialize here, assume helper does it if needed (or called function handles it)
		elizaLogger.debug("Contract read via helper result:", result);
		return result;
	} catch (error) {
		elizaLogger.error("Error during ContractHelper.readContract call:", error);
		if (error instanceof Error) {
			elizaLogger.error("Error name:", error.name);
			elizaLogger.error("Error message:", error.message);
			elizaLogger.error("Error stack:", error.stack);
		}
		throw error;
	}
}
