// tsup.config.ts
import { defineConfig } from "tsup";
var tsup_config_default = defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  format: ["esm"],
  dts: true,
  splitting: false,
  bundle: true,
  minify: false,
  external: [
    "@coinbase/coinbase-sdk",
    "@elizaos/core",
    "@elizaos/plugin-coinbase",
    "@elizaos/plugin-twitter",
    "@elizaos/plugin-0x",
    "express",
    "body-parser",
    "node-fetch",
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
    "coinbase-advanced-sdk",
    "advanced-sdk-ts",
    "jsonwebtoken",
    "whatwg-url"
  ],
  platform: "node",
  target: "node23",
  esbuildOptions(options) {
    options.mainFields = ["module", "main"];
    options.conditions = ["import", "module", "require", "default"];
    options.platform = "node";
  }
});
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3NvZnR3YXJlZW5naW5lZXItZnJvbnRlbmQvRGVza3RvcC9yZWFsaXR5c3BpcmFsL2NsaWVudHMvY2xpZW50LWNvaW5iYXNlL3RzdXAuY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9zb2Z0d2FyZWVuZ2luZWVyLWZyb250ZW5kL0Rlc2t0b3AvcmVhbGl0eXNwaXJhbC9jbGllbnRzL2NsaWVudC1jb2luYmFzZVwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvc29mdHdhcmVlbmdpbmVlci1mcm9udGVuZC9EZXNrdG9wL3JlYWxpdHlzcGlyYWwvY2xpZW50cy9jbGllbnQtY29pbmJhc2UvdHN1cC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidHN1cFwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuXHRlbnRyeTogW1wic3JjL2luZGV4LnRzXCJdLFxuXHRvdXREaXI6IFwiZGlzdFwiLFxuXHRzb3VyY2VtYXA6IHRydWUsXG5cdGNsZWFuOiB0cnVlLFxuXHRmb3JtYXQ6IFtcImVzbVwiXSxcblx0ZHRzOiB0cnVlLFxuXHRzcGxpdHRpbmc6IGZhbHNlLFxuXHRidW5kbGU6IHRydWUsXG5cdG1pbmlmeTogZmFsc2UsXG5cdGV4dGVybmFsOiBbXG5cdFx0XCJAY29pbmJhc2UvY29pbmJhc2Utc2RrXCIsXG5cdFx0XCJAZWxpemFvcy9jb3JlXCIsXG5cdFx0XCJAZWxpemFvcy9wbHVnaW4tY29pbmJhc2VcIixcblx0XHRcIkBlbGl6YW9zL3BsdWdpbi10d2l0dGVyXCIsXG5cdFx0XCJAZWxpemFvcy9wbHVnaW4tMHhcIixcblx0XHRcImV4cHJlc3NcIixcblx0XHRcImJvZHktcGFyc2VyXCIsXG5cdFx0XCJub2RlLWZldGNoXCIsXG5cdFx0XCJmb3JtLWRhdGFcIixcblx0XHRcImNvbWJpbmVkLXN0cmVhbVwiLFxuXHRcdFwiYXhpb3NcIixcblx0XHRcInV0aWxcIixcblx0XHRcInN0cmVhbVwiLFxuXHRcdFwiaHR0cFwiLFxuXHRcdFwiaHR0cHNcIixcblx0XHRcImV2ZW50c1wiLFxuXHRcdFwiY3J5cHRvXCIsXG5cdFx0XCJidWZmZXJcIixcblx0XHRcInVybFwiLFxuXHRcdFwiemxpYlwiLFxuXHRcdFwicXVlcnlzdHJpbmdcIixcblx0XHRcIm9zXCIsXG5cdFx0XCJAcmVmbGluay9yZWZsaW5rXCIsXG5cdFx0XCJAbm9kZS1sbGFtYS1jcHBcIixcblx0XHRcImFnZW50a2VlcGFsaXZlXCIsXG5cdFx0XCJmcy9wcm9taXNlc1wiLFxuXHRcdFwiY3N2LXdyaXRlclwiLFxuXHRcdFwiY3N2LXBhcnNlL3N5bmNcIixcblx0XHRcImRvdGVudlwiLFxuXHRcdFwiY29pbmJhc2UtYWR2YW5jZWQtc2RrXCIsXG5cdFx0XCJhZHZhbmNlZC1zZGstdHNcIixcblx0XHRcImpzb253ZWJ0b2tlblwiLFxuXHRcdFwid2hhdHdnLXVybFwiLFxuXHRdLFxuXHRwbGF0Zm9ybTogXCJub2RlXCIsXG5cdHRhcmdldDogXCJub2RlMjNcIixcblx0ZXNidWlsZE9wdGlvbnMob3B0aW9ucykge1xuXHRcdG9wdGlvbnMubWFpbkZpZWxkcyA9IFtcIm1vZHVsZVwiLCBcIm1haW5cIl07XG5cdFx0b3B0aW9ucy5jb25kaXRpb25zID0gW1wiaW1wb3J0XCIsIFwibW9kdWxlXCIsIFwicmVxdWlyZVwiLCBcImRlZmF1bHRcIl07XG5cdFx0b3B0aW9ucy5wbGF0Zm9ybSA9IFwibm9kZVwiO1xuXHR9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdYLFNBQVMsb0JBQW9CO0FBRXJaLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzNCLE9BQU8sQ0FBQyxjQUFjO0FBQUEsRUFDdEIsUUFBUTtBQUFBLEVBQ1IsV0FBVztBQUFBLEVBQ1gsT0FBTztBQUFBLEVBQ1AsUUFBUSxDQUFDLEtBQUs7QUFBQSxFQUNkLEtBQUs7QUFBQSxFQUNMLFdBQVc7QUFBQSxFQUNYLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLFVBQVU7QUFBQSxJQUNUO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNEO0FBQUEsRUFDQSxVQUFVO0FBQUEsRUFDVixRQUFRO0FBQUEsRUFDUixlQUFlLFNBQVM7QUFDdkIsWUFBUSxhQUFhLENBQUMsVUFBVSxNQUFNO0FBQ3RDLFlBQVEsYUFBYSxDQUFDLFVBQVUsVUFBVSxXQUFXLFNBQVM7QUFDOUQsWUFBUSxXQUFXO0FBQUEsRUFDcEI7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
