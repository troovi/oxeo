import { dataScheme } from '@oxeo/devkit'
import { DefinitionsFactory } from '../../lib/factories/definitions.factory'

const factory = new DefinitionsFactory(dataScheme)

const schemas = {
  worker: factory.createForCollection('worker'),
  bankCard: factory.createForCollection('bankCard'),
  bankDetail: factory.createForCollection('bankDetail'),
  scan: factory.createForCollection('scan'),
  dictionaries: factory.createForCollection('dictionaries'),
  options: factory.createForCollection('options')
}

const workerScheme = dataScheme.models[dataScheme.collectionsScheme.worker.name].scheme

console.dir(schemas.worker, {
  depth: null,
  colors: true
})

if (workerScheme.type === 'discriminated') {
  console.log('\ndiscriminated:\n')

  for (const i of workerScheme.discriminators) {
    console.dir(factory.createDefinitionScheme(i), {
      depth: null,
      colors: true
    })
  }
}
