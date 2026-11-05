import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'

export default defineConfig(({ command }) => ({
  // Project root directory (where index.html is located).
  root: '.', // Можно было бы указать .html в playground, но тогда eslint работал бы нестабильно со смежными директориями. Путь в lintCommand относителен от 'root' пути
  define: {
    'globalThis.__DEV__': JSON.stringify(process.env.disableDev ? false : command === 'serve')
  },
  plugins: [
    checker({
      typescript: true,
      eslint: {
        lintCommand: `eslint "./**/*.{ts,tsx}"`
      }
    })
  ]
}))
