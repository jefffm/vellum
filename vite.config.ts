import { defineConfig } from "vite";
import { VELLUM_BROWSER_SECURITY_HEADERS } from "./src/lib/content-security-policy.js";

const apiPort = Number(process.env.VELLUM_DEV_API_PORT ?? 3000);
const apiTarget = `http://127.0.0.1:${apiPort}`;

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
        target: apiTarget,
        changeOrigin: true,
      },
      "/health": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["tonal"],
  },
});
