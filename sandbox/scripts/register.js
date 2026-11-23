/**
 * Хук `require` для сервера песочницы: `.ts` транслирует сам TypeScript с `emitDecoratorMetadata` — контейнер oxeo
 * собирает домены по `design:paramtypes`, а esbuild (`tsx`) их не пишет. Модули — CommonJS, как у сервера на `tsc`;
 * настройки — из `tsconfig.json` песочницы. Типы здесь не проверяются: это `npm run typecheck`.
 *
 *   node --watch --enable-source-maps -r ./scripts/register.js server/main.ts
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
const { options } = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root)

const compilerOptions = {
  ...options,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  emitDecoratorMetadata: true,
  noEmit: false,
  inlineSourceMap: true
}

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions, fileName: filename })

  module._compile(outputText, filename)
}
