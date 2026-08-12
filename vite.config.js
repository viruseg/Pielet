/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: () => 'pielet.js'
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