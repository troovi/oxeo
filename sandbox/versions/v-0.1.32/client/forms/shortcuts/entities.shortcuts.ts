/**
 * Поля выбора записей локальной базы для форм действий: варианты читает `useAll`, свежие сверху. Выбор одной
 * записи всегда обязателен — он задаёт, над чем действие.
 */
import { SelectForm, SelectTagsForm } from '../../../../../app/kit'
import { AppKey } from '../../../core/keys'
import { useAll } from '../../data'

export const EntityShortForms = {
  WorkerSelect: <N extends string>(name: N) => {
    return SelectForm<number>()(name, {
      placeholder: 'Выберите сотрудника',
      useOptions: useWorkerOptions,
      $rules: {
        required: true
      }
    })
  },
  WorkerTags: <N extends string>(name: N) => {
    return SelectTagsForm<number>()(name, {
      placeholder: 'Выберите сотрудников',
      useOptions: useWorkerOptions
    })
  },
  ClientSelect: <N extends string>(name: N) => {
    return SelectForm<number>()(name, {
      placeholder: 'Выберите клиента',
      useOptions: useClientOptions,
      $rules: {
        required: true
      }
    })
  },
  ProjectSelect: <N extends string>(name: N) => {
    return SelectForm<number>()(name, {
      placeholder: 'Выберите проект',
      useOptions: useProjectOptions,
      $rules: {
        required: true
      }
    })
  },
  ShiftSelect: <N extends string>(name: N) => {
    return SelectForm<number>()(name, {
      placeholder: 'Выберите смену',
      useOptions: useShiftOptions,
      $rules: {
        required: true
      }
    })
  },
  ParticipantSelect: <N extends string>(name: N) => {
    return SelectForm<string>()(name, {
      placeholder: 'Выберите участника смены',
      useOptions: useParticipantOptions,
      $rules: {
        required: true
      }
    })
  },
  /** Любое значение любого справочника — для операций над самим значением. */
  OptionSelect: <N extends string>(name: N) => {
    return SelectForm<string>()(name, {
      placeholder: 'Выберите значение справочника',
      useOptions: useOptionOptions,
      $rules: {
        required: true
      }
    })
  },
  /** Регионы сотрудника — значения справочника `regions`; можно не выбирать. */
  RegionTags: <N extends string>(name: N) => {
    return SelectTagsForm<string>()(name, {
      placeholder: 'Выберите регионы',
      useOptions: () => useDictionaryOptions('regions')
    })
  },
  /** Гражданство — значение справочника `citizenships`; не выбрано — `null`. */
  CitizenshipSelect: <N extends string>(name: N) => {
    return SelectForm<string>()(name, {
      placeholder: 'Выберите гражданство',
      useOptions: () => useDictionaryOptions('citizenships')
    })
  }
}

// options

const useWorkerOptions = () => {
  const workers = useAll('worker')

  const options = workers.map((worker) => ({
    value: worker.workerId,
    title: `#${worker.workerId} ${worker.name}`,
    label: `${worker.type} · ${worker.status}`
  }))

  return { options: options.reverse(), isLoading: false }
}

const useClientOptions = () => {
  const clients = useAll('client')

  const options = clients.map((client) => ({
    value: client.clientId,
    title: `#${client.clientId} ${client.name}`,
    label: `менеджер #${client.managerId}`
  }))

  return { options: options.reverse(), isLoading: false }
}

const useProjectOptions = () => {
  const projects = useAll('project')

  const options = projects.map((project) => ({
    value: project.projectId,
    title: `#${project.projectId} ${project.name}`,
    label: project.stage
  }))

  return { options: options.reverse(), isLoading: false }
}

const useShiftOptions = () => {
  const shifts = useAll('shift')

  const options = shifts.map((shift) => ({
    value: shift.shiftId,
    title: `#${shift.shiftId} · ${shift.date}`,
    label: `${shift.stage} · ${shift.participantIds.length} чел.`
  }))

  return { options: options.reverse(), isLoading: false }
}

const useParticipantOptions = () => {
  const participants = useAll('participant')

  const options = participants.map((participant) => ({
    value: participant.participantId,
    title: `смена #${participant.shiftId} · сотрудник #${participant.workerId}`,
    label: `${participant.role} · ${participant.attendance ?? 'без явки'}`
  }))

  return { options: options.reverse(), isLoading: false }
}

const useOptionOptions = () => {
  const options = useAll('option')

  const items = options.map((option) => ({
    value: option.value,
    title: option.title,
    label: option.dictionary
  }))

  return { options: items.reverse(), isLoading: false }
}

const useDictionaryOptions = (dictionary: AppKey.Dictionary) => {
  const options = useAll('option')

  const own = options.filter((option) => option.dictionary === dictionary)
  const items = own.map((option) => ({ value: option.value, title: option.title }))

  return { options: items, isLoading: false }
}
