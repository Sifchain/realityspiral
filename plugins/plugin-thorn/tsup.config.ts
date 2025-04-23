import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	sourcemap: true,
	clean: true,
	format: ["esm"],
	dts: {
		resolve: true,
		// Only output .d.ts for entry points
		entry: "./src/index.ts",
		// Avoid TS rootDir issues
		compilerOptions: {
			skipLibCheck: true,
			skipDefaultLibCheck: true,
		},
	},
	splitting: false,
	bundle: true,
	minify: false,
	external: [
		"@elizaos/core",
		"@oasisprotocol/client",
		"@realityspiral/plugin-instrumentation",
		"@realityspiral/plugin-coinbase",
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
	platform: "node",
	target: "node18",
	treeshake: true,
	esbuildOptions(options) {
		options.bundle = true;
		options.platform = "node";
		options.target = "node18";
	},
}); 