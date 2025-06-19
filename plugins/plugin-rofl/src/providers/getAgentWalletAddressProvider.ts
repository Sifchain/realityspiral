import type { Provider } from "@elizaos/core";
import { ethers } from "ethers";
import { RoflService } from "../services/rofl";

const roflService = new RoflService();

export const getAgentWalletAddressProvider: Provider = {
	get: async (runtime, _message, _state) => {
		const seed = process.env.ROFL_KEY_GENERATION_SEED;
		if (!seed || seed.trim() === "" || seed.trim().length < 10) {
			throw new Error(
				"ROFL_KEY_GENERATION_SEED environment variable is not set, is empty, or has fewer than 10 characters",
			);
		}
		const keyId = `${runtime.agentId}${seed}`;
		const response = await roflService.generateKey({
			key_id: keyId,
			kind: "secp256k1",
		});

		// Use ethers to create a wallet from the private key and get the public address
		const wallet = new ethers.Wallet(response.key);

		return wallet.address;
	},
};
