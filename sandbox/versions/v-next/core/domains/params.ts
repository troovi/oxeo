/**
 * Схемы параметров операций по реестру: рантайм проверяет ими каждый вызов. Клиент этот файл не
 * импортирует: домены берут из `*.params.ts` только типы, и zod в его сборку не попадает.
 */
import { createDomainsParams } from '../../lib/scheme'
import type { AppDomains } from './index'
import { ClientsParams } from './clients/clients.params'
import { DictionaryParams } from './dictionary/dictionary.params'
import { ProjectsParams } from './projects/projects.params'
import { ShiftsParams } from './shifts/shifts.params'
import { WorkersParams } from './workers/workers.params'

export const appParams = createDomainsParams<AppDomains>({
  dictionary: {
    ensureDictionaries: DictionaryParams.EnsureDictionaries,
    addOption: DictionaryParams.AddOption,
    renameOption: DictionaryParams.RenameOption,
    removeOption: DictionaryParams.RemoveOption
  },
  workers: {
    createOffice: WorkersParams.CreateOffice,
    createRevisor: WorkersParams.CreateRevisor,
    rename: WorkersParams.Rename,
    fire: WorkersParams.Fire
  },
  clients: {
    create: ClientsParams.Create,
    remove: ClientsParams.Remove
  },
  projects: {
    create: ProjectsParams.Create,
    complete: ProjectsParams.Complete
  },
  shifts: {
    create: ShiftsParams.Create,
    launchRecruiting: ShiftsParams.LaunchRecruiting,
    addParticipant: ShiftsParams.AddParticipant,
    withdraw: ShiftsParams.Withdraw,
    setAttendance: ShiftsParams.SetAttendance,
    complete: ShiftsParams.Complete,
    cancel: ShiftsParams.Cancel
  }
})
