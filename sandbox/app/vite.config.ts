import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const SERVER = 'http://localhost:4500'

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  define: { 'globalThis.__DEV__': 'false' },
  // предсборка держит один экземпляр на имя пакета, а снимок и v-next берут разные @oxeo/client и @oxeo/react
  optimizeDeps: { exclude: ['@oxeo/client', '@oxeo/react'], include: ['fast-deep-equal'] },
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
