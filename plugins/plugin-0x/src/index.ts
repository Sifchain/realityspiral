import type { Plugin } from "@elizaos/core";
import { getIndicativePrice } from "./actions/getIndicativePrice";
import { getQuote } from "./actions/getQuote";
import { swap } from "./actions/swap";

export const zxPlugin: Plugin = {
    name: "0x",
    description: "0x Plugin for Eliza",
    actions: [
        getIndicativePrice,
        getQuote,
        swap,
    ],
    evaluators: [],
    providers: [],
};

export { tokenSwap } from "./actions/swap";
export { getPriceInquiry } from "./actions/getIndicativePrice";
export { getQuoteObj } from "./actions/getQuote";
export default zxPlugin;
