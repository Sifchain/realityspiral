import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["./src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	minify: false,
	sourcemap: true,
	external: [
		"@elizaos/core",
		"@oasisprotocol/client",
		"@realityspiral/plugin-instrumentation",
		"@realityspiral/plugin-coinbase",
		"@realityspiral/plugin-rofl",
		"@coinbase/coinbase-sdk",
		"zod",
		"ethers",
	],
	esbuildOptions(options) {
		options.target = ["es2020"];
	},
});
