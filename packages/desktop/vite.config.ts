import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, "src/renderer"),
  resolve: {
    alias: {
      "rapid-cortex-maps": path.join(__dirname, "../maps/src/index.ts"),
    },
  },
  base: "./",
  build: {
    outDir: path.join(__dirname, "dist-renderer"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
