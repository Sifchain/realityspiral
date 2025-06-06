import JSBI from "jsbi";

// exports for external consumption
export type BigintIsh = JSBI | string | number;

export enum TradeType {
	EXACT_INPUT = 0,
	EXACT_OUTPUT = 1,
}

export enum Rounding {
	ROUND_DOWN = 0,
	ROUND_HALF_UP = 1,
	ROUND_UP = 2,
}

export const MaxUint256 = JSBI.BigInt(
	"0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);
