import net from "node:net";
import { elizaLogger } from "@elizaos/core";
import { captureError } from "@realityspiral/sentry";
import axios from "axios";
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
		const isSocketAvailable = await this.checkSocketAvailability();
		if (!isSocketAvailable) {
			throw new Error("ROFL socket is not available");
		}

		try {
			const response = await axios.post<GenerateKeyResponse>(
				"/rofl/v1/keys/generate",
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
}
