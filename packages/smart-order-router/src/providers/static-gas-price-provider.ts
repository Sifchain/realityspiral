// eslint-disable-next-line no-restricted-imports
import type { BigNumber } from "ethers";

import type { GasPrice, IGasPriceProvider } from "./gas-price-provider";

export class StaticGasPriceProvider implements IGasPriceProvider {
	constructor(private gasPriceWei: BigNumber) {}

	async getGasPrice(
		_latestBlockNumber: number,
		_requestBlockNumber?: number,
	): Promise<GasPrice> {
		return { gasPriceWei: this.gasPriceWei };
	}
}
