/**
 * Конфиг карты: каркас раскладки, который задаёт смысл (зоны, их пояса, ряды файлов), и подсказки проекта.
 * Всё остальное — карточки, их порядок внутри файла, маршруты связей — генератор выводит из схемы.
 */

export interface ZoneConfig {
  id: string
  title: string
  /** Цвет зоны в светлой теме; в тёмной — `colorDark` или он же. */
  color: string
  colorDark?: string
  /** Ряды файлов зоны сверху вниз: `[['projects.ts', 'shifts.ts'], ['calendar.ts']]`. */
  files: string[][]
}

export interface Spacing {
  /** Шапка и строка карточки, внутренние поля, минимальная ширина. */
  cardHeader: number
  cardRow: number
  cardPadX: number
  cardMinWidth: number
  /** Промежутки между карточками внутри файла: по горизонтали идут линии композиции. */
  cardGapX: number
  cardGapY: number
  /** Отступы контейнера файла: сверху под подпись. */
  filePadTop: number
  filePadX: number
  filePadBottom: number
  fileGap: number
  /** Отступы зоны: сверху под заголовок. */
  zonePadTop: number
  zonePadX: number
  zonePadBottom: number
  /** Каналы между зонами и поясами — основные трассы связей. */
  zoneGap: number
  bandGap: number
  /** Поля вокруг всей карты. */
  margin: number
}

export const DEFAULT_SPACING: Spacing = {
  cardHeader: 30,
  cardRow: 20,
  cardPadX: 10,
  cardMinWidth: 200,
  cardGapX: 56,
  cardGapY: 24,
  filePadTop: 44,
  filePadX: 30,
  filePadBottom: 30,
  fileGap: 56,
  zonePadTop: 80,
  zonePadX: 24,
  zonePadBottom: 24,
  zoneGap: 96,
  bandGap: 110,
  margin: 40
}

export interface VisualConfig {
  zones: ZoneConfig[]
  /** Пояса сверху вниз, в каждом — зоны слева направо. */
  bands: string[][]
  /** Хаб — коллекция, на которую ссылается столько коллекций или больше. */
  hubMinSources?: number
  spacing?: Partial<Spacing>
}

export const resolveSpacing = (config: VisualConfig): Spacing => ({
  ...DEFAULT_SPACING,
  ...config.spacing
})
