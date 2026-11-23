/** Конфиг тестов страницы операций: схемы нет — `ops-map` она не нужна. */
const { appDomains, descriptions } = require('./domains.cjs')

const LABELS = { director: 'Директор', recruiter: 'Рекрутер', editor: 'Редактор' }

module.exports = {
  operations: {
    domains: appDomains,
    descriptions,
    labelOf: (role) => LABELS[role],
    readme: './README.md'
  }
}
