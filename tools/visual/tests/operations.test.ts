import { execFileSync } from 'child_process'
import { copyFileSync, mkdtempSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import * as path from 'path'
import { describe, expect, it } from 'vitest'
import { extractOperations, opsMapBlock, replaceOpsMap } from '../lib/operations'
import { renderOperationsPage } from '../lib/render/operations'

const project = path.join(__dirname, 'ops-project')
const configPath = path.join(project, 'oxeo-visual.config.cjs')

/** Реестр проекта грузится CommonJS — тем же экземпляром `@oxeo/scheme`, что берёт `extractOperations`. */
const config = createRequire(__filename)(configPath).operations

const TABLE = `| Домен   | Операция  | Действие             | Кто                |
| ------- | --------- | -------------------- | ------------------ |
| \`staff\` | \`list\`    | Список сотрудников   | любой              |
| \`staff\` | \`hire\`    | Нанять сотрудника    | Директор, Рекрутер |
| \`staff\` | \`report\`  | Отчёт по штату       | система            |
| \`notes\` | \`publish\` | Опубликовать заметку | Редактор           |`

describe('операции', () => {
  it('модель: операции — методы со схемой, доступ подписями, схема параметров текстом типа', () => {
    const model = extractOperations(config, configPath)
    const [staff, notes] = model.domains

    expect(model).toMatchObject({ operations: 4, system: 1 })
    expect(staff.operations.map((row) => [row.method, row.callers])).toEqual([
      ['list', 'любой'],
      ['hire', 'Директор, Рекрутер'],
      ['report', 'система']
    ])
    expect(staff.operations[1].params).toBe(
      '{\n  name: string\n  tags: string[]\n  grade: "junior" | "senior" | null\n}'
    )
    expect(staff.operations[0].params).toBe('{\n  query?: string\n}')
    expect(notes).toMatchObject({ title: 'Заметки', operations: [{ title: 'Опубликовать заметку' }] })
  })

  it('таблица README: сводка и колонки «Домен | Операция | Действие | Кто», текст вокруг маркеров цел', () => {
    const model = extractOperations(config, configPath)
    const block = opsMapBlock(model)
    const summary = 'Доменов — 2, операций — 4, из них служебных — 1.'

    expect(block.split('\n').slice(0, 3)).toEqual(['<!-- ops:map:start -->', '', summary])
    expect(block).toContain(TABLE)
    expect(
      replaceOpsMap('до\n<!-- ops:map:start -->\nстарое\n<!-- ops:map:end -->\nпосле', block)
    ).toBe(`до\n${block}\nпосле`)
    expect(() => replaceOpsMap('без маркеров', block)).toThrow('нет маркеров')
  })

  it('страница: домены, операции, доступ и ссылка на карту', () => {
    const html = renderOperationsPage({
      model: extractOperations(config, configPath),
      mapHref: './map.html'
    })

    expect(html).toContain('Нанять сотрудника')
    expect(html).toContain('Директор, Рекрутер')
    expect(html).toContain('href="./map.html"')
  })

  it('oxeo-visual ops-map: собирает в отдельном процессе и переписывает только блок', () => {
    const readme = path.join(mkdtempSync(path.join(tmpdir(), 'oxeo-visual-')), 'README.md')
    const cli = path.join(__dirname, '../dist/cli/index.js')

    copyFileSync(path.join(project, 'README.md'), readme)
    execFileSync(process.execPath, [cli, 'ops-map', '--config', configPath, '--readme', readme])

    const text = readFileSync(readme, 'utf8')

    expect(text.startsWith('# Проект тестов страницы операций\n\nТекст до блока остаётся.\n\n')).toBe(
      true
    )
    expect(text).toContain('Доменов — 2, операций — 4, из них служебных — 1.')
    expect(text).toContain(TABLE)
    expect(text.endsWith('<!-- ops:map:end -->\n\nТекст после блока остаётся.\n')).toBe(true)
  })
})
