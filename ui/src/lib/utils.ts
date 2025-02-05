import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import { UUID } from "@elizaos/core";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

dayjs.extend(localizedFormat);

export const moment = dayjs;

export const formatAgentName = (name: string) => {
    return name.substring(0, 2);
};

export const getSessionId = () => {
    if (!sessionStorage.getItem("sessionId")) {
        const sessionId = crypto.randomUUID();
        sessionStorage.setItem("sessionId", sessionId);
    }
    return sessionStorage.getItem("sessionId");
};

export const getUserId = async (sessionId: string) => {
    return await stringToUuid(sessionId);
};

export const getRoomId = (agentId: string, userId: string) => {
    return `default-room-${agentId}-${userId}`;
};

export async function stringToUuid(target: string | number): Promise<UUID> {
    if (typeof target === "number") {
        target = target.toString();
    }

    if (typeof target !== "string") {
        throw TypeError("Value must be string");
    }

    const _uint8ToHex = (ubyte: number): string => {
        const first = ubyte >> 4;
        const second = ubyte - (first << 4);
        const HEX_DIGITS = "0123456789abcdef".split("");
        return HEX_DIGITS[first] + HEX_DIGITS[second];
    };

    const _uint8ArrayToHex = (buf: Uint8Array): string => {
        let out = "";
        for (let i = 0; i < buf.length; i++) {
            out += _uint8ToHex(buf[i]);
        }
        return out;
    };

    const escapedStr = encodeURIComponent(target);
    const buffer = new TextEncoder().encode(escapedStr);

    // Use Web Crypto API instead of js-sha1
    const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
    const hashArray = new Uint8Array(hashBuffer);

    return (_uint8ArrayToHex(hashArray.slice(0, 4)) +
        "-" +
        _uint8ArrayToHex(hashArray.slice(4, 6)) +
        "-" +
        _uint8ToHex(hashArray[6] & 0x0f) +
        _uint8ToHex(hashArray[7]) +
        "-" +
        _uint8ToHex((hashArray[8] & 0x3f) | 0x80) +
        _uint8ToHex(hashArray[9]) +
        "-" +
        _uint8ArrayToHex(hashArray.slice(10, 16))) as UUID;
}