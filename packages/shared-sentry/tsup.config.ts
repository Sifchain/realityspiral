import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	target: "esnext",
	format: ["esm"],
	splitting: false,
	sourcemap: true,
	clean: true,
	external: ["@elizaos/core", "@sentry/node"],
}); 