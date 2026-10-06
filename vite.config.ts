/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/; CI sets BASE_PATH accordingly.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    // The 3D view is a lazily loaded chunk of ~1.1 MB (≈290 kB gzipped), almost all three.js,
    // react-three-fiber and the bloom/outline effects, which it uses. The 2D view never loads it.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      treeshake: {
        // @react-three/postprocessing imports these at its top level for effects we don't use.
        // They have no import-time side effects but don't say so, so tell the bundler.
        moduleSideEffects: (id: string) => !/node_modules\/(n8ao|maath)\//.test(id),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
})
