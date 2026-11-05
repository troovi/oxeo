/**
 * Объявления типов для подсказок json-полей: интерфейсы, псевдонимы и перечисления, на которые ссылается
 * тип поля, рекурсивно до `MAX_DEPTH`. Псевдонимы-«перечисления» вида `ItemOf<typeof AppKeys.X>` ничего не
 * говорят текстом, поэтому раскрываются в итоговый тип через type checker. Классы (модели и embedded-блоки)
 * и типы стандартной библиотеки не разворачиваются.
 */
import * as path from 'path'
import * as ts from 'typescript'

const MAX_DEPTH = 3
const MAX_DECLARATIONS = 12
const MAX_INLINE = 240

type TypeDeclaration = ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration

const isTypeDeclaration = (node: ts.Node): node is TypeDeclaration =>
  ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)

/** Псевдоним, текст которого не показывает форму: `typeof`, `keyof`, индексный доступ. */
const isOpaque = (decl: TypeDeclaration) => {
  if (!ts.isTypeAliasDeclaration(decl)) return false
  const opaque = (node: ts.Node): boolean =>
    ts.isTypeQueryNode(node) ||
    ts.isTypeOperatorNode(node) ||
    ts.isIndexedAccessTypeNode(node) ||
    Boolean(ts.forEachChild(node, opaque))
  return opaque(decl.type)
}

export class TypeCatalog {
  /** Текст объявлений по идентификатору; идентификатор — имя, при совпадении имён — с файлом. */
  readonly types: Record<string, string> = {}
  private readonly ids = new Map<TypeDeclaration, string>()
  private readonly checker: ts.TypeChecker

  constructor(private readonly program: ts.Program) {
    this.checker = program.getTypeChecker()
  }

  /** Объявления, на которые ссылается тип поля, в порядке появления. */
  refsOf(typeNode: ts.TypeNode | undefined): string[] {
    const out: string[] = []
    if (typeNode) this.collect(typeNode, out, 0)
    return out
  }

  private collect(node: ts.Node, out: string[], depth: number) {
    const visit = (n: ts.Node) => {
      const name = ts.isTypeReferenceNode(n)
        ? n.typeName
        : ts.isExpressionWithTypeArguments(n)
          ? n.expression
          : undefined
      const decl = name && out.length < MAX_DECLARATIONS ? this.resolve(name) : undefined
      if (decl) {
        const id = this.declare(decl)
        if (!out.includes(id)) {
          out.push(id)
          if (depth < MAX_DEPTH && !isOpaque(decl)) this.collect(decl, out, depth + 1)
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(node)
  }

  private resolve(name: ts.Node): TypeDeclaration | undefined {
    let symbol = this.checker.getSymbolAtLocation(name)
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = this.checker.getAliasedSymbol(symbol)
    const decl = symbol?.declarations?.find(isTypeDeclaration)
    if (!decl) return undefined
    const source = decl.getSourceFile()
    const standard =
      this.program.isSourceFileDefaultLibrary(source) ||
      /[\\/]typescript[\\/]lib[\\/]/.test(source.fileName)
    return standard ? undefined : decl
  }

  private declare(decl: TypeDeclaration) {
    const known = this.ids.get(decl)
    if (known) return known
    const name = decl.name.text
    const id = name in this.types ? `${name} (${path.basename(decl.getSourceFile().fileName)})` : name
    this.ids.set(decl, id)
    this.types[id] = isOpaque(decl) ? this.inline(decl as ts.TypeAliasDeclaration) : this.text(decl)
    return id
  }

  /** Исходный текст объявления без `export`, с отступом, снятым до уровня первой строки. */
  private text(decl: TypeDeclaration) {
    const source = decl.getSourceFile()
    const indent = source.getLineAndCharacterOfPosition(decl.getStart()).character
    return decl
      .getText()
      .replace(/^export\s+(declare\s+)?/, '')
      .split('\n')
      .map((line, i) =>
        i === 0 ? line : line.slice(Math.min(indent, line.length - line.trimStart().length))
      )
      .join('\n')
  }

  private inline(decl: ts.TypeAliasDeclaration) {
    const type = this.checker.getTypeAtLocation(decl.name)
    let text = this.checker.typeToString(
      type,
      undefined,
      ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType
    )
    if (text.length > MAX_INLINE) text = `${text.slice(0, MAX_INLINE - 1)}…`
    return `type ${decl.name.text} = ${text}`
  }
}

/** Опции компилятора: из tsconfig проекта или минимальные для разбора схемы с декораторами. */
export const compilerOptions = (tsconfig?: string): ts.CompilerOptions => {
  if (tsconfig) {
    const { config } = ts.readConfigFile(tsconfig, ts.sys.readFile)
    return {
      ...ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(tsconfig)).options,
      noEmit: true
    }
  }
  return {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    experimentalDecorators: true,
    skipLibCheck: true,
    noEmit: true
  }
}
