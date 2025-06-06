import {
	EthereumMainnet,
	OasisSapphireMainnet,
	OasisSapphireTestnet,
	Sepolia,
} from "@neby/chains";
import {
	ChainId,
	type Currency,
	Ether,
	NativeCurrency,
	Token,
} from "@uniswap/sdk-core";

export const HAS_L1_FEE = [];

export const NETWORKS_WITH_SAME_UNISWAP_ADDRESSES = [ChainId.MAINNET];

export const ID_TO_CHAIN_ID = (id: number): ChainId => {
	switch (id) {
		case 1:
			return ChainId.MAINNET;
		case 11155111:
			return ChainId.SEPOLIA;
		case 23294:
			return ChainId.OASIS_SAPPHIRE_MAINNET;
		case 23295:
			return ChainId.OASIS_SAPPHIRE_TESTNET;
		default:
			throw new Error(`Unknown chain id: ${id}`);
	}
};

export enum ChainName {
	MAINNET = "mainnet",
	SEPOLIA = "sepolia",
	OASIS_SAPPHIRE_MAINNET = "oasis-sapphire-mainnet",
	OASIS_SAPPHIRE_TESTNET = "oasis-sapphire-testnet",
}

export const NATIVE_NAMES_BY_ID: { [chainId: number]: string[] } = {
	[ChainId.MAINNET]: [
		"ETH",
		"ETHER",
		"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
	],
	[ChainId.SEPOLIA]: [
		"ETH",
		"ETHER",
		"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
	],
};

export const ID_TO_NETWORK_NAME = (id: number): ChainName => {
	switch (id) {
		case 1:
			return ChainName.MAINNET;
		case 11155111:
			return ChainName.SEPOLIA;
		case 23294:
			return ChainName.OASIS_SAPPHIRE_MAINNET;
		case 23295:
			return ChainName.OASIS_SAPPHIRE_TESTNET;
		default:
			throw new Error(`Unknown chain id: ${id}`);
	}
};

export const CHAIN_IDS_LIST = Object.values(ChainId).map((c) =>
	c.toString(),
) as string[];

export const ID_TO_PROVIDER = (id: ChainId): string => {
	switch (id) {
		case ChainId.OASIS_SAPPHIRE_MAINNET:
			return process.env.JSON_RPC_PROVIDER_OASIS_SAPPHIRE_MAINNET!;
		case ChainId.OASIS_SAPPHIRE_TESTNET:
			return process.env.JSON_RPC_PROVIDER_OASIS_SAPPHIRE_TESTNET!;
		case ChainId.MAINNET:
			return process.env.JSON_RPC_PROVIDER!;
		case ChainId.SEPOLIA:
			return process.env.JSON_RPC_PROVIDER_SEPOLIA!;
		default:
			throw new Error(`Chain id: ${id} not supported`);
	}
};

export const WRAPPED_NATIVE_CURRENCY: { [chainId in ChainId]?: Token } = {
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

export class ExtendedEther extends Ether {
	public get wrapped(): Token {
		if (this.chainId in WRAPPED_NATIVE_CURRENCY) {
			// @ts-ignore
			return WRAPPED_NATIVE_CURRENCY[this.chainId as ChainId];
		}
		throw new Error("Unsupported chain ID");
	}

	private static _cachedExtendedEther: { [chainId: number]: NativeCurrency } =
		{};

	public static onChain(chainId: number): ExtendedEther {
		return (
			this._cachedExtendedEther[chainId] ??
			(this._cachedExtendedEther[chainId] = new ExtendedEther(chainId))
		);
	}
}

const cachedNativeCurrency: { [chainId: number]: NativeCurrency } = {};

export function isOasisNetwork(
	chainId: number,
): chainId is ChainId.OASIS_SAPPHIRE_MAINNET | ChainId.OASIS_SAPPHIRE_TESTNET {
	return (
		chainId === ChainId.OASIS_SAPPHIRE_MAINNET ||
		chainId === ChainId.OASIS_SAPPHIRE_TESTNET
	);
}

class OasisNativeCurrency extends NativeCurrency {
	equals(other: Currency): boolean {
		return other.isNative && other.chainId === this.chainId;
	}

	get wrapped(): Token {
		if (!isOasisNetwork(this.chainId)) throw new Error("Not oasis");
		const nativeCurrency = WRAPPED_NATIVE_CURRENCY[this.chainId];
		if (nativeCurrency) {
			return nativeCurrency;
		}
		throw new Error(`Does not support this chain ${this.chainId}`);
	}

	public constructor(chainId: number) {
		if (!isOasisNetwork(chainId)) throw new Error("Not oasis");
		super(chainId, 18, "ROSE", "Oasis Network");
	}
}

export function nativeOnChain(chainId: number): NativeCurrency {
	if (cachedNativeCurrency[chainId] != undefined) {
		return cachedNativeCurrency[chainId]!;
	}
	if (isOasisNetwork(chainId)) {
		cachedNativeCurrency[chainId] = new OasisNativeCurrency(chainId);
	} else {
		cachedNativeCurrency[chainId] = ExtendedEther.onChain(chainId);
	}

	return cachedNativeCurrency[chainId]!;
}
