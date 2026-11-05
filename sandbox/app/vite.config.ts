import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const SERVER = 'http://localhost:4500'

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  define: { 'globalThis.__DEV__': 'false' },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
        quietDeps: true
      }
    }
  },
  server: {
    port: 4501,
    proxy: {
      '/api': { target: SERVER, rewrite: (path) => path.replace(/^\/api/, '') }
    }
  }
})
