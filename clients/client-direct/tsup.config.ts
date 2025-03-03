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

		// OpenTelemetry modules
		"@opentelemetry/api",
		"@opentelemetry/sdk-trace-base",
		"@opentelemetry/sdk-trace-node",
		"@opentelemetry/resources",
		"@opentelemetry/semantic-conventions",
		"@opentelemetry/context-async-hooks",
		"@opentelemetry/exporter-trace-otlp-http",
		
		// Other modules to externalize
		"@reflink/reflink",
		"@node-llama-cpp",
		"agentkeepalive",
		"safe-buffer",
	],
});
