import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const API_PROXY_PREFIXES = [
  "/hr",
  "/auth",
  "/job",
  "/interview",
  "/api",
  "/masters",
  "/ats",
  "/candidate",
  "/proctor",
  "/session-status",
  "/setup",
  "/extract-skills",
  "/next",
  "/answer",
  "/submit",
  "/report",
  "/models",
  "/candidates",
  "/health",
  "/hr-records",
  "/hr-record",
  "/version",
  "/admin/hr-code",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_BACKEND_URL || "http://127.0.0.1:2020";
  const proxy = Object.fromEntries(
    API_PROXY_PREFIXES.map((prefix) => [
      prefix,
      {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    ])
  );

  return {
    plugins: [react()],
    base: "/admin/",
    server: {
      port: 5173,
      strictPort: true,
      proxy,
    },
    esbuild: {
      // Smaller admin bundle; keep console for prod diagnostics unless you tighten further.
      drop: mode === "production" ? ["debugger"] : [],
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      target: "es2022",
      minify: "esbuild",
      cssCodeSplit: true,
      reportCompressedSize: false,
      // Admin targets modern Chromium/Edge; drops legacy modulepreload polyfill weight.
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("/node_modules/react-dom/") || id.match(/[\\/]node_modules[\\/]react[\\/]/)) {
              return "vendor-react";
            }
            if (id.includes("/node_modules/lucide-react/")) {
              return "vendor-icons";
            }
            if (
              id.includes("/node_modules/html2canvas/") ||
              id.includes("/node_modules/jspdf/") ||
              id.includes("/node_modules/dompurify/")
            ) {
              return "vendor-pdf";
            }
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 400,
    },
  };
});
