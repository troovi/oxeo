import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `workers.fire` — увольнение сотрудника. */
export const useFireWorkerForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [Label({ text: 'workerId', required: true })(EntityShortForms.WorkerSelect('workerId'))]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.workers.fire(values))
  })
}
