import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

const toManualVendorChunk = (id: string) => {
  if (!id.includes("node_modules")) return undefined;

  if (id.includes("/react-dom/") || id.includes("/react/") || id.includes("scheduler")) {
    return "vendor-react";
  }

  if (id.includes("/react-router/") || id.includes("/react-router-dom/")) {
    return "vendor-router";
  }

  if (id.includes("/@tanstack/react-query")) {
    return "vendor-query";
  }

  if (
    id.includes("/recharts/") ||
    id.includes("/framer-motion/") ||
    id.includes("/lucide-react/") ||
    id.includes("/react-icons/")
  ) {
    return "vendor-ui";
  }

  if (
    id.includes("/axios/") ||
    id.includes("/dayjs/") ||
    id.includes("/clsx/") ||
    id.includes("/zod/") ||
    id.includes("/zustand/") ||
    id.includes("/tailwind-merge/")
  ) {
    return "vendor-utils";
  }

  return "vendor-misc";
};

export default defineConfig(({ mode }) => {
  const analyze = mode === "analyze";

  return {
    plugins: [
      react(),
      analyze
        ? visualizer({
            filename: "dist/stats.html",
            template: "treemap",
            gzipSize: true,
            brotliSize: true,
            open: false,
          })
        : null,
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Proxy semua request /api ke server dev
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false,
        },
        // Proxy uploaded assets too
        "/uploads": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: toManualVendorChunk,
        },
      },
    },
  };
});
