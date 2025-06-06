export enum ChainId {
	MAINNET = 1,
	SEPOLIA = 11155111,
	OASIS_SAPPHIRE_MAINNET = 23294,
	OASIS_SAPPHIRE_TESTNET = 23295,
}

export const SUPPORTED_CHAINS = [
	ChainId.OASIS_SAPPHIRE_MAINNET,
	ChainId.OASIS_SAPPHIRE_TESTNET,
	ChainId.MAINNET,
	ChainId.SEPOLIA,
] as const;
export type SupportedChainsType = (typeof SUPPORTED_CHAINS)[number];
