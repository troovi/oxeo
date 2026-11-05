import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import strip from '@rollup/plugin-strip'
import autoExternal from 'rollup-plugin-auto-external'

const plugins = () => {
  return [
    typescript({ tsconfig: './tsconfig.build.json', noEmitOnError: true }),
    autoExternal(),
    resolve(),
    strip(),
    terser()
  ]
}

/**
 * Две сборки индекса: ESM — для сборщиков клиента (Vite, webpack), CommonJS — для node (безголовый клиент, тесты). Вход
 * `@oxeo/scheme/filter` сборка вшивает в себя, поэтому в рантайме клиент к `@oxeo/scheme` не обращается; остальное
 * от схемы — типы. Перед сборкой клиента собирается `@oxeo/scheme`.
 */
export default [
  {
    input: './lib/index.ts',
    output: { file: 'dist/index.esm.js', format: 'esm' },
    plugins: plugins()
  },
  {
    input: './lib/index.ts',
    output: { file: 'dist/index.cjs.js', format: 'cjs' },
    plugins: plugins()
  }
]
