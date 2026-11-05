import { schemaOf } from '../../../lib'
import { ClientEntities } from '../../scheme'

export namespace ClientsParams {
  export const Create = schemaOf(ClientEntities.Client).pick({
    name: true,
    managerId: true
  })
  export const Remove = schemaOf(ClientEntities.Client).pick({ clientId: true })
}
