import type { SupportedChainsType } from "./chains";
import { ChainId, SUPPORTED_CHAINS } from "./chains";
import {
	// EthereumMainnet,
	OasisSapphireMainnet,
	OasisSapphireTestnet,
	Sepolia,
} from "@neby/chains";

type AddressMap = { [chainId: number]: string };

type ChainAddresses = {
	v3CoreFactoryAddress: string;
	multicallAddress: string;
	quoterAddress: string;
	v3MigratorAddress?: string;
	nonfungiblePositionManagerAddress?: string;
	tickLensAddress?: string;
	swapRouter02Address?: string;
	v1MixedRouteQuoterAddress?: string;
	harvesterAddress?: string;
	liquidityPositionStakerAddress?: string;
	nebyStakerAddress?: string;
};

const DEFAULT_NETWORKS = [ChainId.MAINNET, ChainId.SEPOLIA];

function constructSameAddressMap(
	address: string,
	additionalNetworks: ChainId[] = [],
): AddressMap {
	return DEFAULT_NETWORKS.concat(additionalNetworks).reduce<AddressMap>(
		(memo, chainId) => {
			memo[chainId] = address;
			return memo;
		},
		{},
	);
}

export const UNI_ADDRESSES: AddressMap = constructSameAddressMap(
	"0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
	[ChainId.SEPOLIA],
);

export const UNISWAP_NFT_AIRDROP_CLAIM_ADDRESS =
	"0x8B799381ac40b838BBA4131ffB26197C432AFe78";

/**
 * @deprecated use V2_FACTORY_ADDRESSES instead
 */
export const V2_FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
export const V2_FACTORY_ADDRESSES: AddressMap =
	constructSameAddressMap(V2_FACTORY_ADDRESS);
/**
 * @deprecated use V2_ROUTER_ADDRESSES instead
 */
export const V2_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
export const V2_ROUTER_ADDRESSES: AddressMap =
	constructSameAddressMap(V2_ROUTER_ADDRESS);

// Networks that share most of the same addresses i.e. Mainnet, Goerli, Optimism, Arbitrum, Polygon
const DEFAULT_ADDRESSES: ChainAddresses = {
	v3CoreFactoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
	multicallAddress: "0x1F98415757620B543A52E61c46B32eB19261F984",
	quoterAddress: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
	v3MigratorAddress: "0xA5644E29708357803b5A882D272c41cC0dF92B34",
	nonfungiblePositionManagerAddress:
		"0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
};
const MAINNET_ADDRESSES: ChainAddresses = {
	...DEFAULT_ADDRESSES,
	v1MixedRouteQuoterAddress: "0x84E44095eeBfEC7793Cd7d5b57B7e401D7f1cA2E",
};

const OASIS_SAPPHIRE_MAINNET_ADDRESSES: ChainAddresses = {
	v3CoreFactoryAddress: OasisSapphireMainnet.addresses.v3CoreFactory,
	multicallAddress: OasisSapphireMainnet.addresses.multicall,
	quoterAddress: OasisSapphireMainnet.addresses.quoter,
	v3MigratorAddress: OasisSapphireMainnet.addresses.v3Migrator,
	nonfungiblePositionManagerAddress:
		OasisSapphireMainnet.addresses.nonfungiblePositionManager,
	tickLensAddress: OasisSapphireMainnet.addresses.tickLens,
	swapRouter02Address: OasisSapphireMainnet.addresses.swapRouter02,
	harvesterAddress: OasisSapphireMainnet.addresses.harvester,
	liquidityPositionStakerAddress:
		OasisSapphireMainnet.addresses.liquidityPositionStaker,
	nebyStakerAddress: OasisSapphireMainnet.addresses.nebyStaker,
};

const OASIS_SAPPHIRE_TESTNET_ADDRESSES: ChainAddresses = {
	v3CoreFactoryAddress: OasisSapphireTestnet.addresses.v3CoreFactory,
	multicallAddress: OasisSapphireTestnet.addresses.multicall,
	quoterAddress: OasisSapphireTestnet.addresses.quoter,
	v3MigratorAddress: OasisSapphireTestnet.addresses.v3Migrator,
	nonfungiblePositionManagerAddress:
		OasisSapphireTestnet.addresses.nonfungiblePositionManager,
	tickLensAddress: OasisSapphireTestnet.addresses.tickLens,
	swapRouter02Address: OasisSapphireTestnet.addresses.swapRouter02,
	harvesterAddress: OasisSapphireTestnet.addresses.harvester,
	liquidityPositionStakerAddress:
		OasisSapphireTestnet.addresses.liquidityPositionStaker,
	nebyStakerAddress: OasisSapphireTestnet.addresses.nebyStaker,
};

const SEPOLIA_ADDRESSES: ChainAddresses = {
	v3CoreFactoryAddress: Sepolia.addresses.v3CoreFactory,
	multicallAddress: Sepolia.addresses.multicall,
	quoterAddress: Sepolia.addresses.quoter,
	v3MigratorAddress: Sepolia.addresses.v3Migrator,
	nonfungiblePositionManagerAddress:
		Sepolia.addresses.nonfungiblePositionManager,
	tickLensAddress: Sepolia.addresses.tickLens,
	swapRouter02Address: Sepolia.addresses.swapRouter02,
	harvesterAddress: Sepolia.addresses.harvester,
	liquidityPositionStakerAddress: Sepolia.addresses.liquidityPositionStaker,
	nebyStakerAddress: Sepolia.addresses.nebyStaker,
};

export const CHAIN_TO_ADDRESSES_MAP: Record<
	SupportedChainsType,
	ChainAddresses
> = {
	[ChainId.OASIS_SAPPHIRE_MAINNET]: OASIS_SAPPHIRE_MAINNET_ADDRESSES,
	[ChainId.OASIS_SAPPHIRE_TESTNET]: OASIS_SAPPHIRE_TESTNET_ADDRESSES,
	[ChainId.MAINNET]: MAINNET_ADDRESSES,
	[ChainId.SEPOLIA]: SEPOLIA_ADDRESSES,
};

/* V3 Contract Addresses */
export const V3_CORE_FACTORY_ADDRESSES: AddressMap = {
	...SUPPORTED_CHAINS.reduce<AddressMap>((memo, chainId) => {
		memo[chainId] = CHAIN_TO_ADDRESSES_MAP[chainId].v3CoreFactoryAddress;
		return memo;
	}, {}),
};

export const V3_MIGRATOR_ADDRESSES: AddressMap = {
	...SUPPORTED_CHAINS.reduce<AddressMap>((memo, chainId) => {
		const v3MigratorAddress = CHAIN_TO_ADDRESSES_MAP[chainId].v3MigratorAddress;
		if (v3MigratorAddress) {
			memo[chainId] = v3MigratorAddress;
		}
		return memo;
	}, {}),
};

export const MULTICALL_ADDRESSES: AddressMap = {
	...SUPPORTED_CHAINS.reduce<AddressMap>((memo, chainId) => {
		memo[chainId] = CHAIN_TO_ADDRESSES_MAP[chainId].multicallAddress;
		return memo;
	}, {}),
};

export const NONFUNGIBLE_POSITION_MANAGER_ADDRESSES: AddressMap = {
	...SUPPORTED_CHAINS.reduce<AddressMap>((memo, chainId) => {
		const nonfungiblePositionManagerAddress =
			CHAIN_TO_ADDRESSES_MAP[chainId].nonfungiblePositionManagerAddress;
		if (nonfungiblePositionManagerAddress) {
			memo[chainId] = nonfungiblePositionManagerAddress;
		}
		return memo;
	}, {}),
};

export const ENS_REGISTRAR_ADDRESSES: AddressMap = {
	...constructSameAddressMap("0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"),
};

export const SOCKS_CONTROLLER_ADDRESSES: AddressMap = {
	[ChainId.MAINNET]: "0x65770b5283117639760beA3F867b69b3697a91dd",
};

export const MIXED_ROUTE_QUOTER_V1_ADDRESSES: AddressMap =
	SUPPORTED_CHAINS.reduce<AddressMap>((memo, chainId) => {
		const v1MixedRouteQuoterAddress =
			CHAIN_TO_ADDRESSES_MAP[chainId].v1MixedRouteQuoterAddress;
		if (v1MixedRouteQuoterAddress) {
			memo[chainId] = v1MixedRouteQuoterAddress;
		}
		return memo;
	}, {});

export const SWAP_ROUTER_02_ADDRESSES = () => {
	return "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
};

export const HARVESTER_ADDRESSES: AddressMap = {
	...SUPPORTED_CHAINS.reduce<AddressMap>((memo, chainId) => {
		const harvesterAddress = CHAIN_TO_ADDRESSES_MAP[chainId].harvesterAddress;
		if (harvesterAddress) {
			memo[chainId] = harvesterAddress;
		}
		return memo;
	}, {}),
};

export const STAKER_ADDRESSES: AddressMap = {
	...SUPPORTED_CHAINS.reduce<AddressMap>((memo, chainId) => {
		const stakerAddress =
			CHAIN_TO_ADDRESSES_MAP[chainId].liquidityPositionStakerAddress;
		if (stakerAddress) {
			memo[chainId] = stakerAddress;
		}
		return memo;
	}, {}),
};

export const NEBY_STAKER_ADDRESSES: AddressMap = {
	...SUPPORTED_CHAINS.reduce<AddressMap>((memo, chainId) => {
		const stakerAddress = CHAIN_TO_ADDRESSES_MAP[chainId].nebyStakerAddress;
		if (stakerAddress) {
			memo[chainId] = stakerAddress;
		}
		return memo;
	}, {}),
};
