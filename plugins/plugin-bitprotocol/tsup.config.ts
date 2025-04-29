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
		"@oasisprotocol/client", // Keep specific dependency
		"zod", // Keep specific dependency
		"@realityspiral/plugin-instrumentation",
		"@realityspiral/plugin-coinbase", // Keep dependency needed for ContractHelper
	],
	esbuildOptions(options) {
		options.target = ["es2020"];
	},
});
