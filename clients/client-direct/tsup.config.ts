import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	sourcemap: true,
	clean: true,
	format: ["esm"], // Ensure you're targeting CommonJS
	dts: false, // Skip TypeScript declaration generation
	noExternal: [],
	external: [
		// Node.js built-ins
		"dotenv",
		"fs",
		"path",
		"node:fs",
		"node:path",
		"async_hooks",
		"node:async_hooks",
		"http",
		"https",
		"util",
		"node:util",
		// Other modules to externalize
		"@reflink/reflink",
		"@node-llama-cpp",
		"agentkeepalive",
		"safe-buffer",
	],
});
