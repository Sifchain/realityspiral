// for now, just export the perpUtils
export * from "./utils/perpUtils";

import type { Plugin } from "@elizaos/core";
import {
	closePositionAction,
	depositToGateAction,
	getAllInstrumentsAction,
	getPortfolioAction,
	initContextAction,
	placeMarketOrderAction,
	withdrawFromGateAction,
} from "./plugins/perps";

export const synfuturesPlugin: Plugin = {
	name: "synfutures",
	description: "Integration with SynFutures",
	actions: [
		initContextAction,
		getAllInstrumentsAction,
		depositToGateAction,
		placeMarketOrderAction,
		closePositionAction,
		withdrawFromGateAction,
		getPortfolioAction,
	],
	evaluators: [],
	providers: [],
};

export default synfuturesPlugin;
