/**
 * Поля выбора записей для форм действий: варианты читает поле formkit через `useOptions` на `useDb` — поле подписано на
 * записи и показывает загрузку по `isLoading`. Свежие сверху. Выбор одной записи всегда обязателен — он задаёт, над чем
 * действие.
 */
import { SelectForm, SelectTagsForm } from '../../../../../app/kit'
import { AppKey } from '../../../core/keys'
import { useDb } from '../../data'

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
  const { data: workers = [], stage } = useDb((db) => db.worker.all())
  const sorted = [...workers].sort((a, b) => b.createdAt - a.createdAt)

  const options = sorted.map((worker) => ({
    value: worker.workerId,
    title: `#${worker.workerId} ${worker.name}`,
    label: `${worker.type} · ${worker.status}`
  }))

  return { options, isLoading: stage === 'loading' }
}

const useClientOptions = () => {
  const { data: clients = [], stage } = useDb((db) => db.client.all())
  const sorted = [...clients].sort((a, b) => b.createdAt - a.createdAt)

  const options = sorted.map((client) => ({
    value: client.clientId,
    title: `#${client.clientId} ${client.name}`,
    label: `менеджер #${client.managerId}`
  }))

  return { options, isLoading: stage === 'loading' }
}

const useProjectOptions = () => {
  const { data: projects = [], stage } = useDb((db) => db.project.all())
  const sorted = [...projects].sort((a, b) => b.createdAt - a.createdAt)

  const options = sorted.map((project) => ({
    value: project.projectId,
    title: `#${project.projectId} ${project.name}`,
    label: project.stage
  }))

  return { options, isLoading: stage === 'loading' }
}

const useShiftOptions = () => {
  const { data: shifts = [], stage } = useDb((db) => db.shift.all())
  const sorted = [...shifts].sort((a, b) => b.createdAt - a.createdAt)

  const options = sorted.map((shift) => ({
    value: shift.shiftId,
    title: `#${shift.shiftId} · ${shift.date}`,
    label: `${shift.stage} · ${shift.participantIds.length} чел.`
  }))

  return { options, isLoading: stage === 'loading' }
}

const useParticipantOptions = () => {
  const { data: participants = [], stage } = useDb((db) => db.participant.all())
  const sorted = [...participants].sort((a, b) => b.addedAt - a.addedAt)

  const options = sorted.map((participant) => ({
    value: participant.participantId,
    title: `смена #${participant.shiftId} · сотрудник #${participant.workerId}`,
    label: `${participant.role} · ${participant.attendance ?? 'без явки'}`
  }))

  return { options, isLoading: stage === 'loading' }
}

const useOptionOptions = () => {
  const { data: options = [], stage } = useDb((db) => db.option.all())

  const items = options.map((option) => ({
    value: option.value,
    title: option.title,
    label: option.dictionary
  }))

  return { options: items, isLoading: stage === 'loading' }
}

/** Значения одного справочника — запрос по словарю, а не все значения. */
const useDictionaryOptions = (dictionary: AppKey.Dictionary) => {
  const { data: options = [], stage } = useDb((db) => db.option.find({ dictionary }))
  const items = options.map((option) => ({ value: option.value, title: option.title }))

  return { options: items, isLoading: stage === 'loading' }
}
