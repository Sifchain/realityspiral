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
		"@coinbase/coinbase-sdk",
		"zod",
	],
	esbuildOptions(options) {
		options.target = ["es2020"];
	},
}); 