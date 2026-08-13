/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'Pielet',
      formats: ['es', 'iife'],
      fileName: (format) => format === 'es' ? 'pielet.js' : 'pielet.browser.js'
    },
    cssFileName: 'pielet',
    emptyOutDir: true,
    target: 'es2022'
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node'
  }
});