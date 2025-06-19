import net from "node:net";
import { elizaLogger } from "@elizaos/core";
import { captureError } from "@realityspiral/sentry";
import axios from "axios";
import { ethers } from "ethers";
import type { GenerateKeyPayload, GenerateKeyResponse } from "../types";

const DEFAULT_SOCKET_PATH = "/run/rofl-appd.sock";

export class RoflService {
	constructor(private readonly socketPath: string = DEFAULT_SOCKET_PATH) {}

	private async checkSocketAvailability(): Promise<boolean> {
		return new Promise((resolve) => {
			const socket = net.createConnection(this.socketPath, () => {
				socket.end();
				resolve(true);
			});

			socket.on("error", (error) => {
				elizaLogger.error(`ROFL socket not available: ${error.message}`);
				resolve(false);
			});
		});
	}

	async generateKey(payload: GenerateKeyPayload): Promise<GenerateKeyResponse> {
		// Check if mock mode is enabled
		if (process.env.MOCK_ROFL_SERVICE === "true") {
			elizaLogger.info(
				"ROFL service mock mode enabled, returning mocked response",
			);
			return {
				key: "2152d84b9a090d517afb0ebbfff1982b06452078159a950a34b3ae34c81f8446", // Mock private key
			} as GenerateKeyResponse;
		}

		const isSocketAvailable = await this.checkSocketAvailability();
		if (!isSocketAvailable) {
			throw new Error("ROFL socket is not available");
		}

		try {
			const response = await axios.post<GenerateKeyResponse>(
				"http://localhost/rofl/v1/keys/generate",
				payload,
				{
					socketPath: this.socketPath,
				},
			);

			return response.data;
		} catch (error) {
			elizaLogger.error(`Error generating key: ${error.message}`);
			captureError(error as Error, {
				action: "generateKey",
				key_id: payload.key_id,
				kind: payload.kind,
			});
			throw error;
		}
	}

	async getAgentWallet(agentId: string): Promise<ethers.Wallet> {
		const seed = process.env.ROFL_KEY_GENERATION_SEED;
		if (!seed || seed.trim() === "" || seed.trim().length < 10) {
			throw new Error(
				"ROFL_KEY_GENERATION_SEED environment variable is not set, is empty, or has fewer than 10 characters",
			);
		}

		try {
			// Generate the key using agentId + seed as key_id
			const keyId = `${agentId}${seed}`;
			const response = await this.generateKey({
				key_id: keyId,
				kind: "secp256k1",
			});

			// Use ethers to create a wallet from the private key and get the wallet instance
			const wallet = new ethers.Wallet(response.key);

			return wallet;
		} catch (error) {
			elizaLogger.error(
				`Error generating agent public address: ${error.message}`,
			);
			captureError(error as Error, {
				action: "generateAgentPublicAddress",
				agent_id: agentId,
			});
			throw error;
		}
	}
}
