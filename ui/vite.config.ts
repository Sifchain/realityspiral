import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";
import viteCompression from "vite-plugin-compression";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const envDir = path.resolve(__dirname, "..");
	const env = loadEnv(mode, envDir, "");
	return {
		plugins: [
			react(),
			viteCompression({
				algorithm: "brotliCompress",
				ext: ".br",
				threshold: 1024,
			}),
		],
		clearScreen: false,
		envDir,
		define: {
			"import.meta.env.VITE_SERVER_URL": JSON.stringify(
				env.UI_SERVER_URL || "http://localhost:3000",
			),
		},
		build: {
			outDir: "dist",
			minify: true,
			cssMinify: true,
			sourcemap: false,
			cssCodeSplit: true,
		},
		resolve: {
			alias: {
				"@": "/src",
			},
		},
		server: {
			host: "0.0.0.0",
			port: env.UI_PORT ? Number(env.UI_PORT) : 5173,
			...(env.UI_ALLOWED_HOSTS && {
				allowedHosts: env.UI_ALLOWED_HOSTS.split(","),
			}),
		},
	};
});
