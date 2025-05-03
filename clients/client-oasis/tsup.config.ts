import { defineConfig } from "tsup";

export default defineConfig((options) => ({
	entry: ["src/index.ts"],
	splitting: false,
	sourcemap: true,
	clean: !options.watch, // clean dist folder only on production build
	dts: true, // generate dts files
	format: ["cjs", "esm"], // generate cjs and esm files
	minify: !options.watch,
	onSuccess: options.watch ? "node dist/index.js" : undefined,
}));
