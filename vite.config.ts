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
    // The lazily loaded 3D chunk (three.js + react-three-fiber) is ~1.1 MB before gzip.
    // Slimming it is Phase 7 work; until then, warn only if it grows well beyond that.
    chunkSizeWarningLimit: 1300,
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
