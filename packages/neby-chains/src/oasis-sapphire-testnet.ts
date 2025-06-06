import { type ChainConfig, NetworkType } from "./chain.type";

export const OasisSapphireTestnet: ChainConfig = {
	chainId: 23295,
	network: "sapphire-testnet",
	label: "Oasis Sapphire Testnet",
	docs: "https://docs.oasis.io/dapp/sapphire/",
	infoLink: "https://info.uniswap.org/#/",
	type: NetworkType.L1,
	explorer: "https://testnet.explorer.sapphire.oasis.dev",
	rpcs: ["https://testnet.sapphire.oasis.io"],
	subgraph: "https://graph.dev.neby.exchange/dex",
	blockSubgraph: "https://graph.dev.neby.exchange/blocks",
	harvesterSubgraph: "https://graph.dev.neby.exchange/harvester",
	stakerSubgraph: "https://graph.dev.neby.exchange/liquidity-position-staker",
	nebyStakerSubgraph: "https://graph.dev.neby.exchange/neby",
	nativeCurrency: { name: "Sapphire Test Rose", symbol: "TEST", decimals: 18 },
	deployedUnixTimestamp: 1732662716,
	feeRecipient: "0x2996035FA703E0059065df4ca8B4073850C41c37", // ProtocolFeeManager
	feePercent: 15,
	addresses: {
		v3CoreFactory: "0x72fB9f1E620668b71fE127BfaCe428D2972566bf",
		multicall: "0xaB8CBBD37F1B333D4db1231dB8193FABb3B82Ba9",
		quoter: "0x37594AdCeE4E4CD19407DAad635AFeb20b4E503C",
		v3Migrator: "0x518036Ff1328aD6aFe80505d2e7eFcD92C30a66F", // Not required
		nonfungiblePositionManager: "0xC92a3c0DE823b7fd399c3B691097BcCa5e795466",
		tickLens: "0x088D2805310Bc13D9C293422B0b918355Dff6F4E",
		swapRouter02: "0x5dbFD9d19c81021b6dbCb8766d853C7bB761a957",
		harvester: "0x3D9E9404173B1f2EC36F89F64b64116486379142",
		liquidityPositionStaker: "0x0D15fABc2F3Ae45cb6f81A0B27a70FcB56DA2045",
		nebyStaker: "0xE50F34bc1Bf0b5E534C16945600d8bf0de608832",
		// Foundry repositories
		universalRouter: "0x134Ea14cD2acd8dC43aF6e1dE142DEC6290F955F",
		permit2: "0x51A0eeEd1ec83ab08f9B2bCaeb0771f0fCbD8b04",
	},
	weth9: {
		address: "0x84DA87ffd41Abe5c95C8943f2259C986371DFE16",
		symbol: "wROSE",
		decimals: 18,
		name: "Wrapped ROSE",
	},
};
