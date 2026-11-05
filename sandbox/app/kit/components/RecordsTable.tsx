import { Table } from '@companix/uikit'
import { attr } from '@companix/utils-browser'
import { format } from '../format'

interface RecordsTableProps<T extends object> {
  /** Записи в порядке показа; колонки — ключи всех записей (у вариантов дискриминатора поля разные). */
  rows: T[]
  /** Клик по строке — переход в запись; без него строки не кликаются. */
  onRowClick?: (row: T) => void
}

/** Записи таблицей: все поля, моноширинно, ячейка в строку, полный текст — в подсказке. */
export const RecordsTable = <T extends object>({ rows, onRowClick }: RecordsTableProps<T>) => {
  if (rows.length === 0) {
    return <div className="records-empty">Записей нет</div>
  }

  const keys = new Set(rows.flatMap((row) => Object.keys(row)))
  const columns = [...keys] as (keyof T)[]

  return (
    <div className="records" data-clickable={attr(onRowClick !== undefined)}>
      <Table
        className="records-table"
        header={columns.map((column) => ({ content: String(column) }))}
        items={rows}
        onRowClick={onRowClick}
        getItemLayout={(row) => {
          return columns.map((column) => {
            const value = row[column]
            const text = value === undefined ? '' : format.value(value)

            return (
              <span key={`cell-${String(column)}`} title={text}>
                {text}
              </span>
            )
          })
        }}
      />
    </div>
  )
}
