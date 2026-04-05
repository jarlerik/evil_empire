import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: './src/dashboard',
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@evil-empire/ui': path.resolve(__dirname, '../evil_ui/src/index.ts'),
    },
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.js'],
  },
  build: {
    outDir: '../../dist/dashboard',
    emptyOutDir: true,
  },
  server: {
    port: 3940,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3939',
        ws: true,
      },
    },
  },
});
