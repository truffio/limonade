/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Served by GitHub Pages as a project page: https://<owner>.github.io/limonade/
  base: '/limonade/',
  build: {
    target: 'es2022',
    // three.js alone is ~600 kB minified; that is expected for this game.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
