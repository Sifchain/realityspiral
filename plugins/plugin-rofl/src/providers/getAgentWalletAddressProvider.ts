import type { Provider } from "@elizaos/core";
import { ethers } from "ethers";
import { RoflService } from "../services/rofl";

const roflService = new RoflService();

export const getAgentWalletAddressProvider: Provider = {
	get: async (runtime, _message, _state) => {
		const response = await roflService.generateKey({
			key_id: runtime.agentId,
			kind: "secp256k1",
		});

		// Use ethers to create a wallet from the private key and get the public address
		const wallet = new ethers.Wallet(response.key);

		return wallet.address;
	},
};
