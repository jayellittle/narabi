/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig(async ({ mode }) => {
  const plugins = [vue()]

  // Skip vueDevTools in test mode to avoid ERR_REQUIRE_ESM errors
  if (mode !== 'test') {
    const { default: vueDevTools } = await import('vite-plugin-vue-devtools')
    plugins.push(vueDevTools())
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      testTimeout: 10000,
      hookTimeout: 10000,
      teardownTimeout: 5000,
    },
  }
})
