import { CHAIN_TO_ADDRESSES_MAP, ChainId, Token } from "@uniswap/sdk-core";
import { FACTORY_ADDRESS } from "@uniswap/v3-sdk";

import { NETWORKS_WITH_SAME_UNISWAP_ADDRESSES } from "./chains";
import {
	EthereumMainnet,
	OasisSapphireMainnet,
	OasisSapphireTestnet,
	Sepolia,
} from "@neby/chains";

export const V3_CORE_FACTORY_ADDRESSES: AddressMap = {
	...constructSameAddressMap(FACTORY_ADDRESS),
	[ChainId.SEPOLIA]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.SEPOLIA].v3CoreFactoryAddress,
	[ChainId.OASIS_SAPPHIRE_MAINNET]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.OASIS_SAPPHIRE_MAINNET].v3CoreFactoryAddress,
	[ChainId.OASIS_SAPPHIRE_TESTNET]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.OASIS_SAPPHIRE_TESTNET].v3CoreFactoryAddress,
};

export const QUOTER_V2_ADDRESSES: AddressMap = {
	...constructSameAddressMap("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
	[ChainId.SEPOLIA]: CHAIN_TO_ADDRESSES_MAP[ChainId.SEPOLIA].quoterAddress,
	[ChainId.OASIS_SAPPHIRE_MAINNET]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.OASIS_SAPPHIRE_MAINNET].quoterAddress,
	[ChainId.OASIS_SAPPHIRE_TESTNET]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.OASIS_SAPPHIRE_TESTNET].quoterAddress,
};

export const MIXED_ROUTE_QUOTER_V1_ADDRESSES: AddressMap = {
	[ChainId.MAINNET]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.MAINNET].v1MixedRouteQuoterAddress,
	[ChainId.OASIS_SAPPHIRE_MAINNET]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.OASIS_SAPPHIRE_MAINNET]
			.v1MixedRouteQuoterAddress,
	[ChainId.OASIS_SAPPHIRE_TESTNET]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.OASIS_SAPPHIRE_TESTNET]
			.v1MixedRouteQuoterAddress,
};

export const UNISWAP_MULTICALL_ADDRESSES: AddressMap = {
	...constructSameAddressMap("0x1F98415757620B543A52E61c46B32eB19261F984"),
	[ChainId.SEPOLIA]: CHAIN_TO_ADDRESSES_MAP[ChainId.SEPOLIA].multicallAddress,
	[ChainId.OASIS_SAPPHIRE_MAINNET]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.OASIS_SAPPHIRE_MAINNET].multicallAddress,
	[ChainId.OASIS_SAPPHIRE_TESTNET]:
		CHAIN_TO_ADDRESSES_MAP[ChainId.OASIS_SAPPHIRE_TESTNET].multicallAddress,
};

export const SWAP_ROUTER_02_ADDRESSES = (): string => {
	return "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
};

export const OVM_GASPRICE_ADDRESS =
	"0x420000000000000000000000000000000000000F";
export const ARB_GASINFO_ADDRESS = "0x000000000000000000000000000000000000006C";

export type AddressMap = { [chainId: number]: string | undefined };

export function constructSameAddressMap<T extends string>(
	address: T,
	additionalNetworks: ChainId[] = [],
): { [chainId: number]: T } {
	return NETWORKS_WITH_SAME_UNISWAP_ADDRESSES.concat(
		additionalNetworks,
	).reduce<{
		[chainId: number]: T;
	}>((memo, chainId) => {
		memo[chainId] = address;
		return memo;
	}, {});
}

export const WETH9: {
	[chainId in ChainId]?: Token;
} = {
	[ChainId.OASIS_SAPPHIRE_MAINNET]: new Token(
		ChainId.OASIS_SAPPHIRE_MAINNET,
		OasisSapphireMainnet.weth9.address,
		OasisSapphireMainnet.weth9.decimals,
		OasisSapphireMainnet.weth9.symbol,
		OasisSapphireMainnet.weth9.name,
	),
	[ChainId.OASIS_SAPPHIRE_TESTNET]: new Token(
		ChainId.OASIS_SAPPHIRE_TESTNET,
		OasisSapphireTestnet.weth9.address,
		OasisSapphireTestnet.weth9.decimals,
		OasisSapphireTestnet.weth9.symbol,
		OasisSapphireTestnet.weth9.name,
	),
	[ChainId.MAINNET]: new Token(
		ChainId.MAINNET,
		EthereumMainnet.weth9.address,
		EthereumMainnet.weth9.decimals,
		EthereumMainnet.weth9.symbol,
		EthereumMainnet.weth9.name,
	),
	[ChainId.SEPOLIA]: new Token(
		ChainId.SEPOLIA,
		Sepolia.weth9.address,
		Sepolia.weth9.decimals,
		Sepolia.weth9.symbol,
		Sepolia.weth9.name,
	),
};
