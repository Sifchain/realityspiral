export enum NetworkType {
	L1 = 0,
	L2 = 1,
}
export interface ChainConfig {
	chainId: number;
	network: string;
	label: string;
	docs: string;
	infoLink: string;
	bridge?: string;
	status?: string;
	type: NetworkType;
	explorer: string;
	rpcs: string[];
	subgraph: string;
	blockSubgraph: string;
	harvesterSubgraph: string;
	stakerSubgraph: string;
	nebyStakerSubgraph: string;
	nativeCurrency: {
		name: string;
		symbol: string;
		decimals: number;
	};
	deployedUnixTimestamp: number;
	feeRecipient: string;
	feePercent: number; // Fee percent in 10000 basis, 15 = 0.15%
	addresses: {
		v3CoreFactory: string;
		multicall: string;
		quoter: string;
		v3Migrator: string;
		nonfungiblePositionManager: string;
		tickLens: string;
		swapRouter02: string;
		universalRouter: string;
		permit2: string;
		harvester: string;
		liquidityPositionStaker: string;
		nebyStaker: string;
	};
	weth9: {
		address: string;
		symbol: string;
		decimals: number;
		name: string;
	};
}

export interface BridgeInfo {
	[chainId: number]: {
		[chainId: number]: {
			address: string;
		};
	};
}
