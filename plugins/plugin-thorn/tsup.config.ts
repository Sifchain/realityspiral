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
		"zod",
		"ethers",
		"csv-writer",
		"csv-parse",
		"util",
		"stream",
		"http",
		"https",
		"events",
		"crypto",
		"buffer",
		"url",
		"fs/promises",
		"dotenv",
	],
	esbuildOptions(options) {
		options.target = ["es2020"];
	},
});
