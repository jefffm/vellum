import { defineConfig } from "vite";
import { VELLUM_BROWSER_SECURITY_HEADERS } from "./src/lib/content-security-policy.js";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html",
    },
  },
  server: {
    host: "127.0.0.1",
    headers: VELLUM_BROWSER_SECURITY_HEADERS,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["tonal"],
  },
});
