import type { Provider } from "@elizaos/core";
import { RoflService } from "../services/rofl";

const roflService = new RoflService();

export const getRoflKeyProvider: Provider = {
	get: async (runtime, _message, _state) => {
		const response = await roflService.generateKey({
			key_id: runtime.agentId,
			kind: "secp256k1",
		});

		return response.key;
	},
};
