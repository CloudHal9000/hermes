import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// eslint-disable-next-line no-undef
const isElectron = process.env?.ELECTRON === 'true';

export default defineConfig({
  base: isElectron ? './' : '/',
  plugins: [react()],
  optimizeDeps: {
    include: ['roslib'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path,
      }
    }
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:8000')
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
