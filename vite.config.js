import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  build: {
    chunkSizeWarningLimit: 1000,
    // Needed by scripts/checkBundleForHiddenTestLeak.js (Sept 2026 audit,
    // Batch 2): the manifest records which chunks reach which other chunks
    // via a *static* import vs. a *dynamic* import(), which is the actual
    // signal the leak check needs. Chunk filenames alone aren't reliable —
    // Vite names a chunk after its source module's basename regardless of
    // whether it got there via a static or dynamic import, so two very
    // different-risk cases (an eager static import vs. a reviewed lazy
    // fallback) can produce identically-prefixed chunk names.
    manifest: true,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/monaco-editor") ||
            id.includes("node_modules/@monaco-editor")
          ) {
            return "monaco";
          }

          if (
            id.includes("node_modules/firebase") ||
            id.includes("node_modules/@firebase")
          ) {
            return "firebase";
          }

          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router")
          ) {
            return "react-vendor";
          }

          if (
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/react-hot-toast") ||
            id.includes("node_modules/canvas-confetti")
          ) {
            return "ui-vendor";
          }
        },
      },
    },
  },

  server: {
    port: 5173,
  },
});