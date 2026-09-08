import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['pruebas/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Sólo en pruebas: en la app 'server-only' sigue protegiendo el módulo.
      'server-only': resolve(__dirname, 'pruebas/apoyo/server-only.ts'),
      '@': resolve(__dirname, '.'),
    },
  },
})
