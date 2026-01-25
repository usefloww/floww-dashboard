import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from "@vitejs/plugin-react";
import path from 'path';

// Heavy client-only packages that should be externalized from SSR
const clientOnlyPackages = [
  '@llamaindex/chat-ui',
  'react-pdf',
  'pdfjs-dist',
  '@codesandbox/sandpack-react',
  '@codesandbox/sandpack-client',
  'katex',
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
  ssr: {
    // Externalize heavy client-only packages and native modules from SSR
    external: [...clientOnlyPackages],
  },
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname)
    }
  },
});
