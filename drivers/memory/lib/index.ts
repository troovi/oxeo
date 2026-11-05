/**
 * `@oxeo-drivers/memory` — драйвер `@oxeo/server` без базы: коллекции и таблицы связей в памяти процесса, фильтр
 * сверяется `matches`. Для тестов доменов и песочниц: состояние живёт, пока жив процесс.
 */
export * from './collections.driver'
export * from './table.driver'
