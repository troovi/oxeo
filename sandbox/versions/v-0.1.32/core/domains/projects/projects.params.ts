import { schemaOf } from '../../../lib'
import { ProjectEntities } from '../../scheme'

export namespace ProjectsParams {
  const ProjectId = schemaOf(ProjectEntities.Project).pick({ projectId: true })

  export const Create = schemaOf(ProjectEntities.Project).pick({
    clientId: true,
    name: true,
    recruiterIds: true
  })

  export const Complete = ProjectId
}
