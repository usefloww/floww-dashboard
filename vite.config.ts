import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // sentryVitePlugin({
    //   org: "",
    //   project: ""
    // })
  ],

  resolve: {
    alias: {
      '@': '/src'
    }
  },

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: false,
        secure: false,
      },
      "/auth": {
        target: "http://localhost:8000",
        changeOrigin: false,
        secure: false,
      },
      "/admin": {
        target: "http://localhost:8000",
        changeOrigin: false,
        secure: false,
      },
    },
  },

  build: {
    sourcemap: true
  }
});