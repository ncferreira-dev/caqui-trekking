import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // Os testes de integração compartilham UM banco. Rodar em paralelo faria
    // um caso derrubar o dado do outro — o custo de sequencial aqui é baixo e
    // o de flakiness é alto.
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
