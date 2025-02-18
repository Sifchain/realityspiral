// tsup.config.ts
import { defineConfig } from "tsup";
var tsup_config_default = defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  format: ["esm"],
  // Ensure you're targeting CommonJS
  external: [
    "dotenv",
    // Externalize dotenv to prevent bundling
    "fs",
    // Externalize fs to use Node.js built-in module
    "path",
    // Externalize other built-ins if necessary
    "@reflink/reflink",
    "@node-llama-cpp",
    "https",
    "http",
    "agentkeepalive",
    "fs/promises",
    "csv-writer",
    "csv-parse/sync",
    "path",
    "url"
    // Add other modules you want to externalize
  ]
});
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3NvZnR3YXJlZW5naW5lZXItZnJvbnRlbmQvRGVza3RvcC9yZWFsaXR5c3BpcmFsL3BsdWdpbnMvcGx1Z2luLWdpdGh1Yi90c3VwLmNvbmZpZy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvc29mdHdhcmVlbmdpbmVlci1mcm9udGVuZC9EZXNrdG9wL3JlYWxpdHlzcGlyYWwvcGx1Z2lucy9wbHVnaW4tZ2l0aHViXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9zb2Z0d2FyZWVuZ2luZWVyLWZyb250ZW5kL0Rlc2t0b3AvcmVhbGl0eXNwaXJhbC9wbHVnaW5zL3BsdWdpbi1naXRodWIvdHN1cC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidHN1cFwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuXHRlbnRyeTogW1wic3JjL2luZGV4LnRzXCJdLFxuXHRvdXREaXI6IFwiZGlzdFwiLFxuXHRzb3VyY2VtYXA6IHRydWUsXG5cdGNsZWFuOiB0cnVlLFxuXHRmb3JtYXQ6IFtcImVzbVwiXSwgLy8gRW5zdXJlIHlvdSdyZSB0YXJnZXRpbmcgQ29tbW9uSlNcblx0ZXh0ZXJuYWw6IFtcblx0XHRcImRvdGVudlwiLCAvLyBFeHRlcm5hbGl6ZSBkb3RlbnYgdG8gcHJldmVudCBidW5kbGluZ1xuXHRcdFwiZnNcIiwgLy8gRXh0ZXJuYWxpemUgZnMgdG8gdXNlIE5vZGUuanMgYnVpbHQtaW4gbW9kdWxlXG5cdFx0XCJwYXRoXCIsIC8vIEV4dGVybmFsaXplIG90aGVyIGJ1aWx0LWlucyBpZiBuZWNlc3Nhcnlcblx0XHRcIkByZWZsaW5rL3JlZmxpbmtcIixcblx0XHRcIkBub2RlLWxsYW1hLWNwcFwiLFxuXHRcdFwiaHR0cHNcIixcblx0XHRcImh0dHBcIixcblx0XHRcImFnZW50a2VlcGFsaXZlXCIsXG5cdFx0XCJmcy9wcm9taXNlc1wiLFxuXHRcdFwiY3N2LXdyaXRlclwiLFxuXHRcdFwiY3N2LXBhcnNlL3N5bmNcIixcblx0XHRcInBhdGhcIixcblx0XHRcInVybFwiLFxuXHRcdC8vIEFkZCBvdGhlciBtb2R1bGVzIHlvdSB3YW50IHRvIGV4dGVybmFsaXplXG5cdF0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1gsU0FBUyxvQkFBb0I7QUFFL1ksSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDM0IsT0FBTyxDQUFDLGNBQWM7QUFBQSxFQUN0QixRQUFRO0FBQUEsRUFDUixXQUFXO0FBQUEsRUFDWCxPQUFPO0FBQUEsRUFDUCxRQUFRLENBQUMsS0FBSztBQUFBO0FBQUEsRUFDZCxVQUFVO0FBQUEsSUFDVDtBQUFBO0FBQUEsSUFDQTtBQUFBO0FBQUEsSUFDQTtBQUFBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBO0FBQUEsRUFFRDtBQUNELENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
