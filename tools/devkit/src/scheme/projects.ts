import { Identifier, Model, Prop, ReferenceTo, ReferenceSet } from '@oxeo/scheme'
import { DateFormat } from '@companix/utils-js'
import { ClientEntities } from './clients'
import { WorkerEntities } from './workers'
import { DictionaryEntities } from './dictionary'

export namespace ProjectEntities {
  @Model({ name: 'Project' })
  export class Project {
    @Identifier({ type: 'number' })
    projectId: number
    // название проекта
    @Prop({ type: 'string' })
    name: string
    // цена
    @Prop({ type: 'number' })
    price: number
    // клиент проекта
    @ReferenceTo(() => ClientEntities.Client)
    clientId: number
    // объекты выбранного клиента
    @ReferenceSet(() => ClientEntities.Location)
    locationsIds: ClientEntities.Location['locationId'][]
    // кадровик по набору
    @ReferenceTo(() => WorkerEntities.BaseWorker)
    curatorId: WorkerEntities.BaseWorker['workerId']
    // менеджер ОП
    @ReferenceTo(() => WorkerEntities.BaseWorker)
    managerId: WorkerEntities.BaseWorker['workerId']
    // типы работ по проекту
    @ReferenceSet(() => DictionaryEntities.Option)
    type_of_works: DictionaryEntities.Option['value'][]
    // дата начала проекта
    @Prop({ type: 'json' })
    startDate: DateFormat
    // дата завершения
    @Prop({ type: 'json' })
    endDate: DateFormat
    // количество ТМЦ к пересчету
    @Prop({ type: 'number' })
    valuesToCount: number
  }
}
