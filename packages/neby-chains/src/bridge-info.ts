import type { BridgeInfo } from "./chain.type";

// const BridgeChainIds = {
//   OASIS_SAPPHIRE_MAINNET: 23294,
//   OASIS_SAPPHIRE_TESTNET: 23295,
// };

export const bridgeInfo: BridgeInfo = {
	// [BridgeChainIds.OASIS_SAPPHIRE_TESTNET]: {
	//   [BridgeChainIds.BSC_TESTNET]: {
	//     address: '0x7CbF6518972B722E664b8952654b4395Cbc8271A',
	//   },
	// },
	// [BridgeChainIds.BSC_TESTNET]: {
	//   [BridgeChainIds.OASIS_SAPPHIRE_TESTNET]: {
	//     address: '0x0D9953063604Fb60Dcd5088dFE255bc99d7eD999',
	//   },
	// },
};

/**
 * Get the bridge contract address for the given source and destination chain IDs.
 * @param sourceChainId The source chain ID.
 * @param destinationChainId The destination chain ID.
 * @returns The bridge contract address.
 */
export const getBridgeContractAddress = (
	sourceChainId: number,
	destinationChainId: number,
): string | undefined =>
	bridgeInfo?.[sourceChainId]?.[destinationChainId]?.address;
