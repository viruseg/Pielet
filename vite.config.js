/// <reference types="vitest/config" />
import { defineConfig, transformWithEsbuild } from 'vite';

function stripComments() {
  return {
    name: 'pielet-strip-comments',
    async generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk' || typeof file.code !== 'string') continue;
        const result = await transformWithEsbuild(file.code, file.fileName, {
          loader: 'js',
          target: 'es2022',
          minifyWhitespace: true
        });
        file.code = result.code;
      }
    }
  };
}

export default defineConfig({
  plugins: [stripComments()],
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