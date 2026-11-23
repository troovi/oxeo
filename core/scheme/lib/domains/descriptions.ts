/**
 * Описания операций для человека — структура по реестру доменов: у домена — название и что в нём, у каждой операции —
 * название действия и что оно делает. Компилятор не пропустит домен или операцию без описания и описание операции,
 * которой нет. По описаниям `@oxeo/visual` строит страницу операций и таблицу README.
 */
import type { DomainRoutes, DomainsMap } from './domains.types'

/** Операция глазами человека. */
export interface OperationDescription {
  /** Действие, как на кнопке: «Уволить сотрудника». */
  title: string
  /** Что операция делает и чем ограничена — одно-два предложения. */
  description: string
}

/** Домен глазами человека: название области, что в ней, и описания всех его операций. */
export interface DomainDescription<T extends DomainsMap, D extends keyof T> {
  /** Область: «Сотрудники». */
  title: string
  description: string
  methods: { [M in keyof DomainRoutes<T>[D]]: OperationDescription }
}

/** Описания всех доменов реестра — по его ключам. */
export type DomainsDescriptions<T extends DomainsMap> = { [D in keyof T]: DomainDescription<T, D> }
