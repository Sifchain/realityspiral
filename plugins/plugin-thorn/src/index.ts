import { thornSwapPlugin } from "./plugins/swap";
import { thornPriceMonitorPlugin } from "./plugins/priceMonitor";
import { thornStrategyPlugin } from "./plugins/strategy";
import { ABIS, THORN_CONTRACTS } from "./constants";
import { ContractHelper } from "@realityspiral/plugin-coinbase";
import {
	createContractHelper,
	getNetworkId,
	getUserAddressString,
} from "./helpers/contractUtils";

// Export all plugins
export const plugins = {
	thornSwapPlugin,
	thornPriceMonitorPlugin,
	thornStrategyPlugin,
};

// Export types and helpers without creating duplicates
export * from "./types";
// Export only the specific items from constants that don't conflict with types.ts
export {
	ABIS,
	OASIS_NETWORKS,
	OASIS_NETWORK_IDS,
	OASIS_RPC_URLS,
	THORN_DEFAULT_API_URL,
	THORN_DEFAULT_MAX_SLIPPAGE,
	THORN_DEFAULT_MIN_LIQUIDITY,
	THORN_DEFAULT_PRIVACY_LEVEL,
	SWAP_CSV_FILE_PATH,
	PRICE_MONITOR_CSV_FILE_PATH,
	STRATEGY_CSV_FILE_PATH,
	DEFAULT_GAS_LIMIT,
	DEFAULT_GAS_PRICE,
	THORN_CONTRACTS,
	TOKEN_ADDRESSES,
	PRIVACY_LEVEL_VALUES,
} from "./constants";

// Re-export ContractHelper from plugin-coinbase and our utilities
export {
	ContractHelper,
	createContractHelper,
	getNetworkId,
	getUserAddressString,
};

// Default export for the plugin
const thornPlugin = {
	...thornSwapPlugin,
	name: "thorn", // Main plugin name
	actions: [
		...thornSwapPlugin.actions,
		...thornPriceMonitorPlugin.actions,
		...thornStrategyPlugin.actions,
	],
	providers: [
		...thornSwapPlugin.providers,
		...thornPriceMonitorPlugin.providers,
		...thornStrategyPlugin.providers,
	],
};

export default thornPlugin; 