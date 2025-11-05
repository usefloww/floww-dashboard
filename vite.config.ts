import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      sitemap: {
        enabled: false,
      }
    }),
    viteReact(),
    tailwindcss(),
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