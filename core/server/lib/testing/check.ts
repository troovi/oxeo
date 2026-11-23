/**
 * Проверка полноты по исходникам проекта — TypeScript API, без регулярных выражений. Ловит то, чего не видит компилятор
 * и что рантайм заметил бы только на вызове или при старте:
 * - у класса реестра нет роли: домену нужен `@Domain()`, представлению — `@View()`;
 * - публичный метод экземпляра домена или представления без `@Params` — рантайм его не вызовет;
 * - класс графа (домены, представления и классы параметров их конструкторов, транзитивно) с параметрами конструктора
 *   без роли — сервису нужен `@Service()`;
 * - параметр конструктора, тип которого — интерфейс, алиас, примитив или импорт `import type`: в метаданных будет
 *   `Object`; токен, объявленный в одном файле с классом, — тоже;
 * - домен или представление параметром конструктора, сервис, зависящий от домена или представления;
 * - регламент имён: файл `<имя>.<роль>.ts` — класс `<Имя><Роль>` с декоратором роли; класс с ролью — в таком файле;
 *   параметр конструктора с сервисом называется как сервис в camelCase: `shiftsService: ShiftsService`.
 *
 * `typescript` — необязательная peer-зависимость: модуль берёт его только при вызове.
 */
import * as path from 'path'
import type * as TS from 'typescript'

/** Реестр классов в исходниках: файл (от папки tsconfig) и имя экспорта — объект `{ имя: Класс }`. */
export interface RegistryRef {
  file: string
  name: string
}

export interface CheckDomainsOptions {
  /** tsconfig проекта: файлы и настройки программы TypeScript. */
  tsconfig: string
  /** Реестры доменов и представлений. */
  registries: { domains: RegistryRef; views?: RegistryRef }
  /** Папки (от папки tsconfig), чьи файлы проверяет регламент имён; по умолчанию — все файлы программы. */
  include?: string[]
}

type Role = 'domain' | 'service' | 'view'

const ROLES: Record<string, Role> = { Domain: 'domain', Service: 'service', View: 'view' }

/** Роль — суффикс имени класса и имя декоратора: `Service`, `@Service()`. */
const ROLE_NAMES: Record<Role, string> = { domain: 'Domain', service: 'Service', view: 'View' }

/** Файл с ролью: `<имя>.<роль>.ts`. */
const ROLE_FILE = /^(.+)\.(domain|service|view)\.ts$/

/** `task-subjects` → `TaskSubjects`. */
const pascalCase = (text: string) => {
  const parts = text.split(/[-._]/).filter(Boolean)

  return parts.map((part) => part[0].toUpperCase() + part.slice(1)).join('')
}

/** `TaskSubjects` → `task-subjects`. */
const kebabCase = (text: string) => {
  return text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

interface GraphNode {
  declaration: TS.ClassDeclaration
  /** Цепочка от корня — для текста нарушения. */
  path: string[]
}

/**
 * Нарушения правил ролей, схем и токенов — строки «файл: Класс.метод — что не так», пустой список — всё в порядке.
 */
export const checkDomains = ({ tsconfig, registries, include }: CheckDomainsOptions) => {
  const ts: typeof TS = require('typescript')
  const root = path.dirname(path.resolve(tsconfig))
  const config = ts.readConfigFile(path.resolve(tsconfig), ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const refs = [registries.domains, ...(registries.views ? [registries.views] : [])]
  const rootNames = [...parsed.fileNames, ...refs.map((ref) => path.resolve(root, ref.file))]
  const program = ts.createProgram({ rootNames: [...new Set(rootNames)], options: parsed.options })
  const checker = program.getTypeChecker()
  const violations: string[] = []

  // helpers

  const fileOf = (node: TS.Node) => {
    return path.relative(root, node.getSourceFile().fileName)
  }

  const nameOf = (declaration: TS.ClassDeclaration) => {
    return declaration.name?.text ?? 'анонимный класс'
  }

  const report = (node: TS.Node, text: string) => {
    violations.push(`${fileOf(node)}: ${text}`)
  }

  const decoratorNames = (node: TS.Node) => {
    const decorators = ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []

    return decorators.flatMap(({ expression }) => {
      const callee = ts.isCallExpression(expression) ? expression.expression : expression

      if (ts.isIdentifier(callee)) {
        return [callee.text]
      }

      return ts.isPropertyAccessExpression(callee) ? [callee.name.text] : []
    })
  }

  const roleOf = (declaration: TS.ClassDeclaration) => {
    const role = decoratorNames(declaration).find((name) => name in ROLES)

    return role ? ROLES[role] : null
  }

  const isProjectFile = (node: TS.Node) => {
    const file = node.getSourceFile()

    return !file.isDeclarationFile && !program.isSourceFileFromExternalLibrary(file)
  }

  const isAlias = (symbol: TS.Symbol | undefined): symbol is TS.Symbol => {
    return symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
  }

  /** Символ, на который ведёт импорт; у своего символа — он сам. */
  const targetOf = (symbol: TS.Symbol | undefined) => {
    return isAlias(symbol) ? checker.getAliasedSymbol(symbol) : symbol
  }

  const classOf = (symbol: TS.Symbol | undefined) => {
    return targetOf(symbol)?.declarations?.find(ts.isClassDeclaration) ?? null
  }

  const constructorOf = (declaration: TS.ClassDeclaration) => {
    const constructors = declaration.members.filter(ts.isConstructorDeclaration)

    return constructors.find((member) => member.body) ?? constructors[0] ?? null
  }

  const baseOf = (declaration: TS.ClassDeclaration) => {
    const isExtends = ({ token }: TS.HeritageClause) => token === ts.SyntaxKind.ExtendsKeyword
    const heritage = declaration.heritageClauses?.find(isExtends)
    const expression = heritage?.types[0]?.expression

    return expression ? classOf(checker.getSymbolAtLocation(expression)) : null
  }

  /** Выражение без обёрток `as`, `satisfies` и скобок. */
  const unwrap = (node: TS.Expression): TS.Expression => {
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
      return unwrap(node.expression)
    }

    return ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node
  }

  // registries

  const registryClasses = (ref: RegistryRef) => {
    const file = program.getSourceFile(path.resolve(root, ref.file))
    const statements = file?.statements.filter(ts.isVariableStatement) ?? []
    const declarations = statements.flatMap((statement) => [...statement.declarationList.declarations])
    const declaration = declarations.find(({ name }) => {
      return ts.isIdentifier(name) && name.text === ref.name
    })
    const initializer = declaration?.initializer && unwrap(declaration.initializer)

    if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
      throw new Error(`checkDomains: ${ref.file} — нет объекта ${ref.name}`)
    }

    return initializer.properties.flatMap((property) => {
      const symbol = ts.isShorthandPropertyAssignment(property)
        ? checker.getShorthandAssignmentValueSymbol(property)
        : ts.isPropertyAssignment(property)
          ? checker.getSymbolAtLocation(property.initializer)
          : undefined
      const found = classOf(symbol)

      return found ? [found] : []
    })
  }

  // methods

  /** Публичные методы экземпляра класса и его базовых классов из исходников проекта. */
  const publicMethods = (declaration: TS.ClassDeclaration): TS.MethodDeclaration[] => {
    const base = baseOf(declaration)
    const inherited = base && isProjectFile(base) ? publicMethods(base) : []
    const own = declaration.members.filter((member): member is TS.MethodDeclaration => {
      const modifiers = ts.getCombinedModifierFlags(member)
      const hidden = ts.ModifierFlags.Private | ts.ModifierFlags.Protected | ts.ModifierFlags.Static
      const isPrivateName = member.name !== undefined && ts.isPrivateIdentifier(member.name)

      return ts.isMethodDeclaration(member) && !(modifiers & hidden) && !isPrivateName
    })
    const names = new Set(own.map((member) => member.name.getText()))

    return [...inherited.filter((member) => !names.has(member.name.getText())), ...own]
  }

  const checkParams = (declaration: TS.ClassDeclaration) => {
    for (const method of publicMethods(declaration)) {
      const isImplementation = method.body !== undefined

      if (isImplementation && !decoratorNames(method).includes('Params')) {
        report(method, `${nameOf(declaration)}.${method.name.getText()} — публичный метод без @Params`)
      }
    }
  }

  // graph

  /** Класс параметра конструктора или нарушение: тип без класса за ним в метаданных станет `Object`. */
  const dependencyOf = (owner: TS.ClassDeclaration, parameter: TS.ParameterDeclaration, i: number) => {
    const subject = `${nameOf(owner)} — параметр ${i + 1}`
    const type = parameter.type

    if (!type || !ts.isTypeReferenceNode(type)) {
      const text = type?.getText() ?? 'без типа'

      report(parameter, `${subject} (${text}) — не класс: в метаданных не будет класса`)
      return null
    }

    const typeName = ts.isQualifiedName(type.typeName) ? type.typeName.right : type.typeName
    const symbol = checker.getSymbolAtLocation(typeName)
    const alias = isAlias(symbol) ? symbol.declarations?.[0] : undefined
    const isTypeOnly = alias !== undefined && ts.isTypeOnlyImportOrExportDeclaration(alias)
    const label = `${subject} (${typeName.text})`

    if (isTypeOnly) {
      report(parameter, `${label} — import type: в метаданных будет Object`)
      return null
    }

    const dependency = classOf(symbol)

    if (!dependency) {
      report(parameter, `${label} — интерфейс или алиас: в метаданных будет Object`)
      return null
    }

    const isMerged = targetOf(symbol)?.declarations?.some(ts.isInterfaceDeclaration) ?? false
    const isSameFile = dependency.getSourceFile() === owner.getSourceFile()

    if (isMerged && isSameFile) {
      report(parameter, `${label} — токен в одном файле с классом: в метаданных будет Object`)
      return null
    }

    return dependency
  }

  const visited = new Set<TS.ClassDeclaration>()

  const walk = ({ declaration, path: chain }: GraphNode) => {
    if (visited.has(declaration)) {
      return
    }

    visited.add(declaration)

    const constructor = constructorOf(declaration)
    const parameters = constructor?.parameters ?? []
    const role = roleOf(declaration)

    if (parameters.length > 0 && role === null) {
      report(declaration, `${chain.join(' → ')} — класс с параметрами без роли: нужен @Service()`)
    }

    parameters.forEach((parameter, i) => {
      const dependency = dependencyOf(declaration, parameter, i)

      if (!dependency || !isProjectFile(dependency)) {
        return
      }

      const dependencyRole = roleOf(dependency)
      const next = [...chain, nameOf(dependency)]
      const parameterName = parameter.name.getText()
      const expectedName = nameOf(dependency)[0].toLowerCase() + nameOf(dependency).slice(1)

      if (dependencyRole === 'service' && parameterName !== expectedName) {
        const subject = `${nameOf(declaration)} — параметр ${parameterName}: ${nameOf(dependency)}`

        report(parameter, `${subject} называется ${expectedName}`)
      }
      const isRoot = dependencyRole === 'domain' || dependencyRole === 'view'

      if (isRoot && role === 'service') {
        report(parameter, `${next.join(' → ')} — сервис зависит от домена или представления`)
        return
      }

      if (isRoot) {
        const rule = 'домен и представление — корни графа, параметром не внедряются'

        report(parameter, `${next.join(' → ')} — ${rule}`)
        return
      }

      walk({ declaration: dependency, path: next })
    })
  }

  // names

  /** Классы без роли в файлах с ролью — о них уже сказал регламент имён. */
  const unmarked = new Set<TS.ClassDeclaration>()

  /** Регламент имён файла: `<имя>.<роль>.ts` — класс `<Имя><Роль>` с декоратором роли. */
  const checkNames = (file: TS.SourceFile) => {
    const match = path.basename(file.fileName).match(ROLE_FILE)
    const fileRole = match ? (match[2] as Role) : null

    for (const declaration of file.statements.filter(ts.isClassDeclaration)) {
      const role = roleOf(declaration)
      const name = nameOf(declaration)

      if (role === null && fileRole !== null) {
        unmarked.add(declaration)
        report(declaration, `${name} — нет декоратора роли @${ROLE_NAMES[fileRole]}()`)
        continue
      }

      if (role === null) {
        continue
      }

      const suffix = ROLE_NAMES[role]
      const decorator = `@${suffix}()`

      if (!match || fileRole !== role) {
        const base = name.endsWith(suffix) ? name.slice(0, -suffix.length) : name

        report(declaration, `${name} — класс с ${decorator} лежит в ${kebabCase(base)}.${role}.ts`)
        continue
      }

      const expected = `${pascalCase(match[1])}${suffix}`

      if (name !== expected) {
        report(declaration, `${name} — класс с ${decorator} называется ${expected}`)
      }
    }
  }

  const folders = (include ?? ['.']).map((folder) => path.resolve(root, folder) + path.sep)
  const files = program.getSourceFiles().filter((file) => {
    const isIncluded = folders.some((folder) => file.fileName.startsWith(folder))

    return isIncluded && isProjectFile(file)
  })

  files.forEach(checkNames)

  // roots

  const roots = [
    ...registryClasses(registries.domains).map((declaration) => {
      return { declaration, role: 'domain' as const }
    }),
    ...(registries.views ? registryClasses(registries.views) : []).map((declaration) => {
      return { declaration, role: 'view' as const }
    })
  ]

  for (const { declaration, role } of roots) {
    const decorator = `@${ROLE_NAMES[role]}()`

    if (roleOf(declaration) !== role && !unmarked.has(declaration)) {
      report(declaration, `${nameOf(declaration)} — класс реестра без ${decorator}`)
    }

    checkParams(declaration)
    walk({ declaration, path: [nameOf(declaration)] })
  }

  return violations
}
