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
    // имена классов нужны текстам ошибок контейнера: «Ids нет в представлении»
    terser({ keep_classnames: true })
  ]
}

/**
 * Три входа, у каждого ESM — для сборщиков — и CommonJS — для node. Главный вход — схема, домены и `schemaOf` с zod: его
 * исполняет сервер. Вход `filter` — язык фильтра без декораторов и zod: его берёт в рантайме клиент (`filter/package.json`).
 * Вход `di` — роли классов с полифилом `reflect-metadata`: только серверу (`di/package.json`).
 */
export default [
  {
    input: './lib/index.ts',
    output: { file: 'dist/bundle.esm.js', format: 'esm' },
    plugins: plugins()
  },
  {
    input: './lib/index.ts',
    output: { file: 'dist/bundle.cjs.js', format: 'cjs' },
    plugins: plugins()
  },
  {
    input: './lib/filter/index.ts',
    output: { file: 'dist/filter.esm.js', format: 'esm' },
    plugins: plugins()
  },
  {
    input: './lib/filter/index.ts',
    output: { file: 'dist/filter.cjs.js', format: 'cjs' },
    plugins: plugins()
  },
  {
    input: './lib/di/index.ts',
    output: { file: 'dist/di.esm.js', format: 'esm' },
    plugins: plugins()
  },
  {
    input: './lib/di/index.ts',
    output: { file: 'dist/di.cjs.js', format: 'cjs' },
    plugins: plugins()
  }
]
