import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig(({ mode }) => ({
  plugins: [react(), wasm(), topLevelAwait()],
  define: {
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@eddalabs/voting-contract': path.resolve(__dirname, '../voting-contract/src/index.ts'),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
}));
