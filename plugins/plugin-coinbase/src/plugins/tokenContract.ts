import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	Coinbase,
	type SmartContract,
	readContract,
} from "@coinbase/coinbase-sdk";
import {
	type Action,
	type Content,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type Plugin,
	type State,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import {
	composeContext,
	traceResult,
} from "@realityspiral/plugin-instrumentation";
import { createArrayCsvWriter } from "csv-writer";
import { ABI } from "../constants";
import {
	contractInvocationTemplate,
	readContractTemplate,
	tokenContractTemplate,
} from "../templates";
import {
	ContractInvocationSchema,
	ReadContractSchema,
	TokenContractSchema,
	isContractInvocationContent,
	isReadContractContent,
	isTokenContractContent,
} from "../types";
import { initializeWallet, ContractHelper } from "../utils";

// Dynamically resolve the file path to the src/plugins directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, "../../plugin-coinbase/src/plugins");
const contractsCsvFilePath = path.join(baseDir, "contracts.csv");

export const deployTokenContractAction: Action = {
	name: "DEPLOY_TOKEN_CONTRACT",
	description:
		"Deploy an ERC20, ERC721, or ERC1155 token contract using the Coinbase SDK",
	validate: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.info("Validating runtime for DEPLOY_TOKEN_CONTRACT...");
		return (
			!!(
				runtime.character.settings.secrets?.COINBASE_API_KEY ||
				process.env.COINBASE_API_KEY
			) &&
			!!(
				runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY ||
				process.env.COINBASE_PRIVATE_KEY
			)
		);
	},
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.debug("Starting DEPLOY_TOKEN_CONTRACT handler...");

		try {
			Coinbase.configure({
				apiKeyName:
					runtime.getSetting("COINBASE_API_KEY") ??
					process.env.COINBASE_API_KEY,
				privateKey:
					runtime.getSetting("COINBASE_PRIVATE_KEY") ??
					process.env.COINBASE_PRIVATE_KEY,
			});

			// Ensure CSV file exists
			if (!fs.existsSync(contractsCsvFilePath)) {
				const csvWriter = createArrayCsvWriter({
					path: contractsCsvFilePath,
					header: [
						"Contract Type",
						"Name",
						"Symbol",
						"Network",
						"Contract Address",
						"Transaction URL",
						"Base URI",
						"Total Supply",
					],
				});
				await csvWriter.writeRecords([]);
			}

			const context = composeContext({
				state,
				template: tokenContractTemplate,
			});

			const contractDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: TokenContractSchema,
			});
			elizaLogger.info("Contract details:", contractDetails.object);

			if (!isTokenContractContent(contractDetails.object)) {
				callback(
					{
						text: "Invalid contract details. Please check the inputs.",
					},
					[],
				);
				return;
			}

			const { contractType, name, symbol, network, baseURI, totalSupply } =
				contractDetails.object;
			elizaLogger.info("Contract details:", contractDetails.object);
			const { wallet } = await initializeWallet(runtime, network);
			let contract: SmartContract;
			// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
			let deploymentDetails;

			switch (contractType.toLowerCase()) {
				case "erc20":
					contract = await wallet.deployToken({
						name,
						symbol,
						totalSupply: totalSupply || 1000000,
					});
					deploymentDetails = {
						contractType: "ERC20",
						totalSupply,
						baseURI: "N/A",
					};
					break;

				case "erc721":
					contract = await wallet.deployNFT({
						name,
						symbol,
						baseURI: baseURI || "",
					});
					deploymentDetails = {
						contractType: "ERC721",
						totalSupply: "N/A",
						baseURI,
					};
					break;
				default:
					throw new Error(`Unsupported contract type: ${contractType}`);
			}

			// Wait for deployment to complete
			await contract.wait();
			elizaLogger.info("Deployment details:", deploymentDetails);
			elizaLogger.info("Contract deployed successfully:", contract);
			// Log deployment to CSV
			const csvWriter = createArrayCsvWriter({
				path: contractsCsvFilePath,
				header: [
					"Contract Type",
					"Name",
					"Symbol",
					"Network",
					"Contract Address",
					"Transaction URL",
					"Base URI",
					"Total Supply",
				],
				append: true,
			});
			const transaction = contract.getTransaction()?.getTransactionLink() || "";
			const contractAddress = contract.getContractAddress();
			await csvWriter.writeRecords([
				[
					deploymentDetails.contractType,
					name,
					symbol,
					network,
					contractAddress,
					transaction,
					deploymentDetails.baseURI,
					deploymentDetails.totalSupply || "",
				],
			]);

			const response: Content = {
				text: `Token contract deployed successfully:
- Type: ${deploymentDetails.contractType}
- Name: ${name}
- Symbol: ${symbol}
- Network: ${network}
- Contract Address: ${contractAddress}
- Transaction URL: ${transaction}
${deploymentDetails.baseURI !== "N/A" ? `- Base URI: ${deploymentDetails.baseURI}` : ""}
${deploymentDetails.totalSupply !== "N/A" ? `- Total Supply: ${deploymentDetails.totalSupply}` : ""}.`,
			};

			callback(response, []);

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error deploying token contract:", error);
			callback(
				{
					text: `Failed to deploy token contract: ${error.message}`,
				},
				[],
			);
		}
	},
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Deploy an ERC721 token named 'MyNFT' with symbol 'MNFT' on base network with URI 'https://pbs.twimg.com/profile_images/1848823420336934913/oI0-xNGe_400x400.jpg'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Token contract deployed successfully:
- Type: ERC20
- Name: MyToken
- Symbol: MTK
- Network: base
- Contract Address: 0x...
- Transaction URL: https://basescan.org/tx/...
- Total Supply: 1000000`,
				},
			},
			{
				user: "{{user1}}",
				content: {
					text: "Deploy an ERC721 token named 'MyNFT' with symbol 'MNFT' on the base network",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Token contract deployed successfully:
- Type: ERC721
- Name: MyNFT
- Symbol: MNFT
- Network: base
- Contract Address: 0x...
- Transaction URL: https://basescan.org/tx/...
- URI: https://pbs.twimg.com/profile_images/1848823420336934913/oI0-xNGe_400x400.jpg`,
				},
			},
		],
	],
	similes: ["DEPLOY_CONTRACT", "CREATE_TOKEN", "MINT_TOKEN", "CREATE_NFT"],
};

// Add to tokenContract.ts
export const invokeContractAction: Action = {
	name: "INVOKE_CONTRACT",
	description:
		"Invoke a method on a deployed smart contract using the Coinbase SDK",
	validate: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.info("Validating runtime for INVOKE_CONTRACT...");
		return (
			!!(
				runtime.character.settings.secrets?.COINBASE_API_KEY ||
				process.env.COINBASE_API_KEY
			) &&
			!!(
				runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY ||
				process.env.COINBASE_PRIVATE_KEY
			)
		);
	},
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.debug("Starting INVOKE_CONTRACT handler...");

		try {
			const contractHelper = new ContractHelper(runtime);

			const context = composeContext({
				state,
				template: contractInvocationTemplate,
			});

			const invocationDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.LARGE,
				schema: ContractInvocationSchema,
			});
			elizaLogger.info("Invocation details:", invocationDetails.object);
			if (!isContractInvocationContent(invocationDetails.object)) {
				callback(
					{
						text: "Invalid contract invocation details. Please check the inputs.",
					},
					[],
				);
				return;
			}

			const { contractAddress, method, args, amount, assetId, networkId } =
				invocationDetails.object;

			// Invoke the contract using helper
			const result = await contractHelper.invokeContract(
				contractAddress,
				method,
				args,
				networkId,
				ABI,
				amount,
				assetId
			);

			// Log the invocation to CSV
			const csvWriter = createArrayCsvWriter({
				path: contractsCsvFilePath,
				header: [
					"Contract Address",
					"Method",
					"Network",
					"Status",
					"Transaction URL",
					"Amount",
					"Asset ID",
				],
				append: true,
			});

			await csvWriter.writeRecords([
				[
					contractAddress,
					method,
					networkId,
					result.status,
					result.transactionLink,
					amount || "",
					assetId || "",
				],
			]);

			const response: Content = {
				text: `Contract method invoked successfully:
- Contract Address: ${contractAddress}
- Method: ${method}
- Network: ${networkId}
- Status: ${result.status}
- Transaction URL: ${result.transactionLink || "N/A"}${amount ? `\n- Amount: ${amount}` : ""}
${assetId ? `- Asset ID: ${assetId}` : ""}`,
			};

			callback(response, []);

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error invoking contract method: ", error.message);
			callback(
				{
					text: `Failed to invoke contract method: ${error.message}`,
				},
				[],
			);
		}
	},
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Call the 'transfer' method on my ERC20 token contract at 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 with amount 100 to recipient 0xbcF7C64B880FA89a015970dC104E848d485f99A3",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Contract method invoked successfully:
- Contract Address: 0x123...
- Method: transfer
- Network: base
- Status: SUCCESS
- Transaction URL: https://basescan.org/tx/...
- Amount: 100
- Asset ID: wei

Contract invocation has been logged to the CSV file.`,
				},
			},
		],
	],
	similes: ["CALL_CONTRACT", "EXECUTE_CONTRACT", "INTERACT_WITH_CONTRACT"],
};

export const readContractAction: Action = {
	name: "READ_CONTRACT",
	description:
		"Read data from a deployed smart contract using the Coinbase SDK",
	validate: async (runtime: IAgentRuntime, _message: Memory) => {
		elizaLogger.info("Validating runtime for READ_CONTRACT...");
		return (
			!!(
				runtime.character.settings.secrets?.COINBASE_API_KEY ||
				process.env.COINBASE_API_KEY
			) &&
			!!(
				runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY ||
				process.env.COINBASE_PRIVATE_KEY
			)
		);
	},
	handler: async (
		runtime: IAgentRuntime,
		_message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback: HandlerCallback,
	) => {
		elizaLogger.debug("Starting READ_CONTRACT handler...");

		try {
			const contractHelper = new ContractHelper(runtime);

			const context = composeContext({
				state,
				template: readContractTemplate,
			});

			const readDetails = await generateObject({
				runtime,
				context,
				modelClass: ModelClass.SMALL,
				schema: ReadContractSchema,
			});

			if (!isReadContractContent(readDetails.object)) {
				callback(
					{
						text: "Invalid contract read details. Please check the inputs.",
					},
					[],
				);
				return;
			}

			const { contractAddress, method, args, networkId } = readDetails.object;
			const result = await contractHelper.readContract(
				contractAddress,
				method,
				args,
				networkId,
				ABI
			);

			const response: Content = {
				text: `Contract read successful:
- Contract Address: ${contractAddress}
- Method: ${method}
- Network: ${networkId}
- Result: ${JSON.stringify(result, null, 2)}`,
			};

			callback(response, []);

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error("Error reading contract: ", error.message);
			callback(
				{
					text: `Failed to read contract: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
				[],
			);
		}
	},
	examples: [
		[
			{
				user: "{{user1}}",
				content: {
					text: "Read the balance of address 0xbcF7C64B880FA89a015970dC104E848d485f99A3 from the ERC20 contract at 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 on eth",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: `Contract read successful:
- Contract Address: 0x37f2131ebbc8f97717edc3456879ef56b9f4b97b
- Method: balanceOf
- Network: eth
- Result: "1000000"`,
				},
			},
		],
	],
	similes: ["READ_CONTRACT", "GET_CONTRACT_DATA", "QUERY_CONTRACT"],
};

export const tokenContractPlugin: Plugin = {
	name: "tokenContract",
	description:
		"Enables deployment, invocation, and reading of ERC20, ERC721, and ERC1155 token contracts using the Coinbase SDK",
	actions: [
		deployTokenContractAction,
		invokeContractAction,
		readContractAction,
	],
};
