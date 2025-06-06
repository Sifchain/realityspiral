import { type ChainConfig, NetworkType } from "./chain.type";

export const OasisSapphireMainnet: ChainConfig = {
	chainId: 23294,
	network: "oasis-sapphire-mainnet",
	label: "Oasis Sapphire",
	docs: "https://docs.oasis.io/dapp/sapphire/",
	infoLink: "https://info.uniswap.org/#/",
	type: NetworkType.L1,
	explorer: "https://explorer.sapphire.oasis.dev",
	rpcs: ["https://sapphire.oasis.io"],
	subgraph: "https://graph.api.neby.exchange/dex",
	blockSubgraph: "https://graph.api.neby.exchange/blocks",
	harvesterSubgraph: "https://graph.api.neby.exchange/harvester",
	stakerSubgraph: "https://graph.api.neby.exchange/liquidity-position-staker",
	nebyStakerSubgraph: "https://graph.api.neby.exchange/neby",
	nativeCurrency: { name: "Sapphire Rose", symbol: "ROSE", decimals: 18 },
	deployedUnixTimestamp: 1732718190,
	feeRecipient: "0x4137A572001BE40aD31881CB2298153b6CB0186B", // ProtocolFeeManager
	feePercent: 15,
	addresses: {
		v3CoreFactory: "0x218D71cd52363B7A47cD31549f3b9031d74A585A",
		multicall: "0x05568F4E3e4F0c3E7b8664e302f269574fEAD13A",
		quoter: "0xA7A00B2493F362B5232337398C0eC6052165464c",
		v3Migrator: "0x518036Ff1328aD6aFe80505d2e7eFcD92C30a66F", // Not required
		nonfungiblePositionManager: "0x2D69C85166B8B84916EF49FF20f287f9Eb6381fe",
		tickLens: "0x96488E235627Fd7A5a82B555dbbfd1F0d268C757",
		swapRouter02: "0x6Dd410DbF04b2C197353CD981eCC374906eB62F6",
		harvester: "0xE310Bce86F2ff352C091e2257943bfd0923cb1Df",
		liquidityPositionStaker: "0x7A0D1E8AE82E163bAdBF7bd563111F3b05F07c46",
		nebyStaker: "0x269Ddf6666BA65dAa32ca526fa1F14D9aC7dD3b4",
		// Foundry repositories
		universalRouter: "0xd099ef034EaAbFb7db7334B9b3E8a0dA4d50949a",
		permit2: "0xA3dF2613A995693E81a6e3a8Ea3fcB770c5fF800",
	},
	weth9: {
		address: "0x8Bc2B030b299964eEfb5e1e0b36991352E56D2D3",
		symbol: "wROSE",
		decimals: 18,
		name: "Wrapped ROSE",
	},
};
