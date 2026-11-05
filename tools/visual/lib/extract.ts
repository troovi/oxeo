/**
 * Извлечение модели схемы: метаданные oxeo (поля, связи, поведение при удалении) плюс исходники схемы
 * (файл и namespace класса, JSDoc, типы TS, порядок объявления полей). Не знает ничего о проекте.
 */
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import type { ModelProperties, PropertyMeta, SchemeSource, TargetRefs } from './scheme-meta'
import type { Entity, Field, OnDelete, Relation, SchemeModel } from './model'
import { TypeCatalog, compilerOptions } from './types'

export interface ExtractOptions {
  /** Каталог с исходниками классов схемы (`*.ts`). */
  sourceDir: string
  /** tsconfig проекта — чтобы type checker разрешал импорты типов так же, как сборка. */
  tsconfig?: string
}

interface PropSource {
  doc?: string
  order: number
  tsType?: string
  typeNode?: ts.TypeNode
  decorators: string[]
}

/** Текст узла одной строкой: многострочные декораторы после prettier сворачиваются. */
const oneLine = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/([([]) /g, '$1')
    .replace(/ ([)\]])/g, '$1')

interface ClassSource {
  file: string
  namespace?: string
  decorator: string | null
  decorators: string[]
  doc?: string
  props: Map<string, PropSource>
}

const LIST_ITEM = /^([-*•]|\d+[.)])\s/

/**
 * JSDoc в исходниках перенесён по ширине строки: строки одного абзаца склеиваются в одну. Абзацы (пустая строка
 * в комментарии) и пункты списков остаются на своих строках.
 */
export const reflow = (text: string) =>
  text
    .split(/\n[ \t]*\n/)
    .map((paragraph) => {
      let out = ''
      for (const line of paragraph.split('\n').map((l) => l.trim())) {
        if (!line) continue
        out = !out ? line : LIST_ITEM.test(line) ? `${out}\n${line}` : `${out} ${line}`
      }
      return out
    })
    .filter(Boolean)
    .join('\n\n')

const jsDoc = (node: ts.Node) => {
  const text = reflow(
    ts
      .getJSDocCommentsAndTags(node)
      .filter(ts.isJSDoc)
      .map((d) => ts.getTextOfJSDocComment(d.comment) ?? '')
      .join('\n\n')
  )
  return text || undefined
}

const schemeFiles = (sourceDir: string) =>
  fs.readdirSync(sourceDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))

const parseSources = (sourceDir: string, program: ts.Program) => {
  const classes = new Map<string, ClassSource[]>()

  for (const file of schemeFiles(sourceDir)) {
    const source = program.getSourceFile(path.join(sourceDir, file))
    if (!source) continue

    const visit = (node: ts.Node, namespace?: string) => {
      if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
        ts.forEachChild(node, (child) => visit(child, node.name.getText(source)))
        return
      }
      if (ts.isClassDeclaration(node) && node.name) {
        const decorator = (ts.getDecorators(node) ?? [])
          .map((d) =>
            ts.isCallExpression(d.expression) ? d.expression.expression.getText(source) : null
          )
          .find((name) => name !== null)
        const props = new Map<string, PropSource>()
        node.members.forEach((member, order) => {
          if (ts.isPropertyDeclaration(member) && member.name) {
            props.set(member.name.getText(source), {
              doc: jsDoc(member),
              order,
              tsType: member.type?.getText(source).replace(/\s+/g, ' '),
              typeNode: member.type,
              decorators: (ts.getDecorators(member) ?? []).map((d) => oneLine(d.getText(source)))
            })
          }
        })
        const list = classes.get(node.name.text) ?? []
        list.push({
          file,
          namespace,
          decorator: decorator ?? null,
          decorators: (ts.getDecorators(node) ?? []).map((d) => oneLine(d.getText(source))),
          doc: jsDoc(node),
          props
        })
        classes.set(node.name.text, list)
      }
      ts.forEachChild(node, (child) => visit(child, namespace))
    }

    visit(source)
  }

  // Имена классов в разных namespace могут совпадать (`PayoutConfig`): различаем по декоратору
  return (target: Function, embedded: boolean): ClassSource | undefined => {
    const list = classes.get(target.name)
    if (!list) return undefined
    return list.find((c) => (c.decorator === 'Embedded') === embedded) ?? list[0]
  }
}

export const extractScheme = (dataScheme: SchemeSource, options: ExtractOptions): SchemeModel => {
  const collections = dataScheme.collectionsScheme
  const models = dataScheme.models
  const keyByModel = new Map(Object.entries(collections).map(([key, info]) => [info.name, key]))
  const program = ts.createProgram(
    schemeFiles(options.sourceDir).map((f) => path.join(options.sourceDir, f)),
    compilerOptions(options.tsconfig)
  )
  const catalog = new TypeCatalog(program)
  const findSource = parseSources(options.sourceDir, program)

  const onDeleteOf = (consumerModel: string, address: string, targetModel: string): OnDelete => {
    const inverse = models[targetModel]?.refscheme.inverseRefs.find(
      (ref) => ref.model === consumerModel && ref.modelConsumerProperty === address
    )
    return inverse?.onDeleteBehavior ?? 'restrict'
  }

  const typeOf = (primitive: Exclude<PropertyMeta['primitive'], { type: 'embedded' }>) =>
    primitive.type === 'array' ? `array<${primitive.itemType}>` : primitive.type

  const buildFields = (
    props: ModelProperties,
    prefix: string,
    refs: TargetRefs,
    modelName: string
  ): Field[] => {
    const ordered: { order: number; field: Field }[] = []

    const sourceOf = (target: Function, key: string) => {
      const prop = findSource(target, prefix !== '')?.props.get(key)
      return {
        doc: prop?.doc,
        tsType: prop?.tsType,
        typeNode: prop?.typeNode,
        decorators: prop?.decorators.length ? prop.decorators : undefined,
        order: prop?.order ?? Number.MAX_SAFE_INTEGER
      }
    }

    for (const prop of props.properties) {
      const address = prefix + prop.propertyKey
      const { doc, tsType, typeNode, decorators, order } = sourceOf(prop.target, prop.propertyKey)
      const primitive = prop.primitive

      if (primitive.type === 'embedded') {
        const inner = [...primitive.properties, ...primitive.references][0]?.target
        const classDoc = inner && findSource(inner, true)?.doc
        ordered.push({
          order,
          field: {
            name: prop.propertyKey,
            path: address,
            kind: 'embedded',
            type: inner?.name,
            decorators,
            doc: [doc, classDoc].filter(Boolean).join('\n\n') || undefined,
            fields: buildFields(primitive, address + '.', refs, modelName)
          }
        })
        continue
      }

      ordered.push({
        order,
        field: {
          name: prop.propertyKey,
          path: address,
          kind: 'prop',
          type: typeOf(primitive),
          tsType,
          decorators,
          // У json-полей форма значения — в типе TS: собираем его объявления для подсказки
          typeRefs:
            primitive.type === 'json' || (primitive.type === 'array' && primitive.itemType === 'json')
              ? catalog.refsOf(typeNode)
              : undefined,
          nullable: 'nullable' in primitive ? primitive.nullable : undefined,
          values: 'values' in primitive ? primitive.values : undefined,
          doc
        }
      })
    }

    for (const relation of props.references) {
      const address = prefix + relation.propertyKey
      const { doc, decorators, order } = sourceOf(relation.target, relation.propertyKey)
      const ref = refs[address]
      const targetModel = ref?.model ?? relation.referenceModel().name
      const base = {
        name: relation.propertyKey,
        path: address,
        target: keyByModel.get(targetModel),
        decorators,
        doc
      }

      if (ref?.refType === 'reference-to') {
        ordered.push({
          order,
          field: {
            ...base,
            kind: 'ref',
            nullable: ref.nullable,
            onDelete: onDeleteOf(modelName, address, targetModel)
          }
        })
      } else if (ref?.refType === 'reference-set') {
        ordered.push({
          order,
          field: { ...base, kind: 'set', onDelete: onDeleteOf(modelName, address, targetModel) }
        })
      } else if (ref?.refType === 'has-many') {
        ordered.push({
          order,
          field: {
            ...base,
            kind: 'own',
            onDelete: ref.cleanupBehavior ?? 'cascade',
            ownerField: ref.modelBelongsToProperty
          }
        })
      } else if (ref?.refType === 'belongs-to') {
        ordered.push({ order, field: { ...base, kind: 'owner' } })
      } else {
        console.warn(
          `  ! ${modelName}.${address}: связь ${ref?.refType ?? relation.refType} не отображается`
        )
      }
    }

    return ordered.sort((a, b) => a.order - b.order).map((item) => item.field)
  }

  const entities = Object.keys(collections).map((key, order): Entity => {
    const { name } = collections[key]
    const { scheme, refscheme } = models[name]
    const source = findSource(scheme.target, false)

    const entity: Entity = {
      key,
      model: name,
      file: source?.file ?? '?',
      namespace: source?.namespace,
      order,
      idKey: scheme.identifier.propertyKey,
      idType: scheme.identifier.options.type,
      doc: source?.doc,
      decorators: source?.decorators,
      fields: [
        {
          name: scheme.identifier.propertyKey,
          path: scheme.identifier.propertyKey,
          kind: 'id',
          type: scheme.identifier.options.type,
          decorators: source?.props.get(scheme.identifier.propertyKey)?.decorators,
          doc: source?.props.get(scheme.identifier.propertyKey)?.doc
        },
        ...buildFields(scheme, '', refscheme.commonRefs, name)
      ],
      variants: []
    }

    if (scheme.type === 'discriminated') {
      entity.discriminatorKey = scheme.discriminatorKey
      entity.variants = scheme.discriminators.map((d) => ({
        value: d.value,
        model: d.name,
        doc: findSource(d.target, false)?.doc,
        decorators: findSource(d.target, false)?.decorators,
        fields: buildFields(d, '', refscheme.discriminatorRefs?.[d.value] ?? {}, name)
      }))
    }

    return entity
  })

  const relations: Relation[] = []
  for (const entity of entities) {
    const walk = (fields: Field[], variant?: string) => {
      for (const field of fields) {
        if (field.fields) walk(field.fields, variant)
        if ((field.kind === 'ref' || field.kind === 'set' || field.kind === 'own') && field.target) {
          relations.push({
            id: `${entity.key}.${field.path}${variant ? `@${variant}` : ''}`,
            source: entity.key,
            target: field.target,
            kind: field.kind,
            field: field.path,
            ownerField: field.ownerField,
            onDelete: field.onDelete ?? 'restrict',
            nullable: field.nullable ?? false,
            variant
          })
        }
      }
    }
    walk(entity.fields)
    entity.variants.forEach((v) => walk(v.fields, v.value))
  }

  const files: SchemeModel['files'] = []
  for (const entity of entities) {
    if (!files.some((f) => f.file === entity.file))
      files.push({ file: entity.file, namespace: entity.namespace })
  }

  return { entities, relations, files, types: catalog.types }
}
