/**
 * Реестр доменов для тестов страницы операций — на CommonJS, как его загрузит процесс сборки: декораторы применены
 * вызовами, без транспиляции.
 */
const { Allow, Params, System } = require('@oxeo/scheme')
const { z } = require('zod')

class StaffDomain {
  async list() {
    return []
  }

  async hire() {
    return 1
  }

  async report() {
    return null
  }
}

class NotesDomain {
  async publish() {
    return null
  }
}

/** Декораторы метода — снизу вверх, как их применяет TypeScript. */
const decorate = (Class, method, decorators) => {
  const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, method)

  for (const decorator of [...decorators].reverse()) {
    decorator(Class.prototype, method, descriptor)
  }
}

decorate(StaffDomain, 'list', [Params(z.object({ query: z.string().optional() }))])
decorate(StaffDomain, 'hire', [
  Allow('director', 'recruiter'),
  Params(
    z.object({
      name: z.string(),
      tags: z.array(z.string()),
      grade: z.enum(['junior', 'senior']).nullable()
    })
  )
])
decorate(StaffDomain, 'report', [System('Только планировщик'), Params(z.object({}))])
decorate(NotesDomain, 'publish', [Allow('editor'), Params(z.object({ noteId: z.number() }))])

const appDomains = { staff: StaffDomain, notes: NotesDomain }

const descriptions = {
  staff: {
    title: 'Сотрудники',
    description: 'Штат компании.',
    methods: {
      list: { title: 'Список сотрудников', description: 'Сотрудники по строке поиска.' },
      hire: { title: 'Нанять сотрудника', description: 'Новый сотрудник с грейдом.' },
      report: { title: 'Отчёт по штату', description: 'Строит планировщик раз в сутки.' }
    }
  },
  notes: {
    title: 'Заметки',
    description: 'Тексты сотрудников.',
    methods: {
      publish: { title: 'Опубликовать заметку', description: 'Заметка становится видна всем.' }
    }
  }
}

module.exports = { appDomains, descriptions }
