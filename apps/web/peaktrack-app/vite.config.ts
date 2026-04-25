import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { resolve } from 'node:path';

// RN-Web alias config copied from apps/evil_ui/vite.config.ts so evil_ui
// components and any react-native imports resolve to react-native-web.
// Order in `extensions` matters: .web.tsx wins over .tsx so a future
// Component.web.tsx sibling can override the native version on web.
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './app/routes',
      generatedRouteTree: './app/routeTree.gen.ts',
    }),
    react(),
  ],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': resolve(__dirname, './app'),
    },
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.js'],
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
