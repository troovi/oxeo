import { Identifier, Model, Prop, ReferenceTo, ReferenceSet } from '@oxeo/scheme'
import { FileFormat } from '@companix/utils-js'
import { ProjectEntities } from './projects'
import { WorkerEntities } from './workers'
import { DictionaryEntities } from './dictionary'

export namespace ClientEntities {
  @Model({ name: 'Legal' })
  export class Legal {
    @Identifier({ type: 'string' })
    legalId: string

    @Prop({ type: 'string' })
    name: string

    @Prop({ type: 'string' })
    full_name: string

    @Prop({ type: 'string' })
    inn: string

    @Prop({ type: 'string' })
    kpp: string

    @Prop({ type: 'string' })
    ogrn: string

    @Prop({ type: 'string' })
    rs: string

    @Prop({ type: 'string' })
    kors: string

    @Prop({ type: 'string' })
    bik: string

    @Prop({ type: 'string' })
    bank_name: string

    @Prop({ type: 'string' })
    legal_address: string

    @Prop({ type: 'string' })
    fact_address: string

    @Prop({ type: 'string' })
    phone: string

    @Prop({ type: 'string' })
    email: string
  }

  @Model({ name: 'Location' })
  export class Location {
    @Identifier({ type: 'string' })
    locationId: string

    @ReferenceTo(() => Legal)
    legalId: Legal['legalId']

    @Prop({ type: 'string' })
    name: string

    @Prop({ type: 'string' })
    address: string

    @Prop({ type: 'string' })
    comment: string

    @ReferenceTo(() => DictionaryEntities.Option)
    location_type: DictionaryEntities.Option['value']

    @ReferenceTo(() => DictionaryEntities.Option)
    value_type: DictionaryEntities.Option['value']
  }

  @Model({ name: 'Contact' })
  export class Contact {
    @Identifier({ type: 'string' })
    contactId: string

    @Prop({ type: 'string' })
    name: string

    @Prop({ type: 'string' })
    surname: string

    @Prop({ type: 'string' })
    patronymic: string

    @Prop({ type: 'string' })
    phone: string

    @Prop({ type: 'string' })
    email: string

    @Prop({ type: 'string' })
    rolename: string

    @ReferenceSet(() => Location)
    locations: Location['locationId'][]
  }

  @Model({ name: 'Client' })
  export class Client {
    @Identifier({ type: 'number' })
    clientId: number

    @Prop({ type: 'string' })
    companyname: string

    @Prop({ type: 'string' })
    comment: string

    @Prop({ type: 'json' })
    logo: FileFormat

    @ReferenceTo(() => WorkerEntities.BaseWorker)
    managerId: WorkerEntities.BaseWorker['workerId']

    @ReferenceTo(() => WorkerEntities.BaseWorker, { onRefDeleting: 'set-null' })
    subManagerId: WorkerEntities.BaseWorker['workerId'] | null

    @Prop({ type: 'number' })
    createdAt: number

    @ReferenceSet(() => Legal)
    legals: Legal['legalId'][]

    @ReferenceSet(() => Location)
    locations: Location['locationId'][]

    @ReferenceSet(() => Contact)
    contacts: Contact['contactId'][]

    @ReferenceSet(() => ProjectEntities.Project)
    projects: ProjectEntities.Project['projectId'][]
  }
}
