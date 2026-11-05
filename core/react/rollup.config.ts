import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import strip from '@rollup/plugin-strip'
import autoExternal from 'rollup-plugin-auto-external'

export default [
  {
    input: './lib/index.ts',
    output: {
      file: 'dist/bundle.esm.js',
      format: 'esm'
    },
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    plugins: [
      typescript({ tsconfig: './tsconfig.build.json', noEmitOnError: true }),
      autoExternal(),
      resolve(),
      strip(),
      terser()
    ]
  }
]
