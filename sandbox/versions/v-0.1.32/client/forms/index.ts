import { DomainGroup } from '../../../../app/kit'
import { useAddOptionForm } from './use-add-option-form'
import { useAddParticipantForm } from './use-add-participant-form'
import { useCancelShiftForm } from './use-cancel-shift-form'
import { useCompleteProjectForm } from './use-complete-project-form'
import { useCompleteShiftForm } from './use-complete-shift-form'
import { useCreateClientForm } from './use-create-client-form'
import { useCreateOfficeForm } from './use-create-office-form'
import { useCreateProjectForm } from './use-create-project-form'
import { useCreateRevisorForm } from './use-create-revisor-form'
import { useCreateShiftForm } from './use-create-shift-form'
import { useFireWorkerForm } from './use-fire-worker-form'
import { useLaunchRecruitingForm } from './use-launch-recruiting-form'
import { useRemoveClientForm } from './use-remove-client-form'
import { useRemoveOptionForm } from './use-remove-option-form'
import { useRenameOptionForm } from './use-rename-option-form'
import { useRenameWorkerForm } from './use-rename-worker-form'
import { useSetAttendanceForm } from './use-set-attendance-form'
import { useWithdrawParticipantForm } from './use-withdraw-participant-form'

/**
 * Карта форм действий для панели операций: домены группами, в группе — действия с именем метода и хуком
 * формы. Хук сам строит форму formkit и в отправке вызывает операцию через `DomainsAPI`. Посев
 * `dictionary.ensureDictionaries` — только системе, формы у него нет.
 */
export const domainForms: DomainGroup[] = [
  {
    domain: 'dictionary',
    actions: [
      { name: 'addOption', useForm: useAddOptionForm },
      { name: 'renameOption', useForm: useRenameOptionForm },
      { name: 'removeOption', useForm: useRemoveOptionForm }
    ]
  },
  {
    domain: 'workers',
    actions: [
      { name: 'createOffice', useForm: useCreateOfficeForm },
      { name: 'createRevisor', useForm: useCreateRevisorForm },
      { name: 'rename', useForm: useRenameWorkerForm },
      { name: 'fire', useForm: useFireWorkerForm }
    ]
  },
  {
    domain: 'clients',
    actions: [
      { name: 'create', useForm: useCreateClientForm },
      { name: 'remove', useForm: useRemoveClientForm }
    ]
  },
  {
    domain: 'projects',
    actions: [
      { name: 'create', useForm: useCreateProjectForm },
      { name: 'complete', useForm: useCompleteProjectForm }
    ]
  },
  {
    domain: 'shifts',
    actions: [
      { name: 'create', useForm: useCreateShiftForm },
      { name: 'launchRecruiting', useForm: useLaunchRecruitingForm },
      { name: 'addParticipant', useForm: useAddParticipantForm },
      { name: 'withdraw', useForm: useWithdrawParticipantForm },
      { name: 'setAttendance', useForm: useSetAttendanceForm },
      { name: 'complete', useForm: useCompleteShiftForm },
      { name: 'cancel', useForm: useCancelShiftForm }
    ]
  }
]
