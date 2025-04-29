import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	sourcemap: true,
	clean: true,
	format: ["esm"], // Ensure you're targeting CommonJS
	external: [
		"form-data",
		"combined-stream",
		"axios",
		"util",
		"stream",
		"http",
		"https",
		"events",
		"crypto",
		"buffer",
		"url",
		"zlib",
		"querystring",
		"os",
		"@reflink/reflink",
		"@node-llama-cpp",
		"agentkeepalive",
		"fs/promises",
		"csv-writer",
		"csv-parse/sync",
		"dotenv",
		"advanced-sdk-ts",
		"jsonwebtoken",
		"whatwg-url",
		// Add other modules you want to externalize
		"@realityspiral/sentry",
	],
});
