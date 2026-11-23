/**
 * Описания операций для человека — по реестру доменов: компилятор не пропустит домен или операцию без описания и
 * описание операции, которой нет. По ним `@oxeo/visual` строит страницу «Операции» и таблицу README версии.
 */
import type { DomainsDescriptions } from '../../lib/scheme'
import type { AppDomains } from './index'

export const appDomainsDescriptions: DomainsDescriptions<AppDomains> = {
  dictionary: {
    title: 'Справочники',
    description: 'Регионы и гражданство: перечень словарей фиксирован, значения заводятся операциями.',
    methods: {
      ensureDictionaries: {
        title: 'Завести справочники',
        description: 'Посев: идемпотентно заводит словари перечня, только система.'
      },
      addOption: {
        title: 'Добавить значение',
        description: 'Новое значение словаря; название уникально в словаре.'
      },
      renameOption: {
        title: 'Переименовать значение',
        description: 'Новое название значения; уникально в его словаре.'
      },
      removeOption: {
        title: 'Удалить значение',
        description: 'Схема снимает значение с записей, которые на него ссылаются.'
      }
    }
  },
  workers: {
    title: 'Сотрудники',
    description: 'Офисные сотрудники и ревизоры с одним счётчиком номеров.',
    methods: {
      createOffice: {
        title: 'Принять офисного сотрудника',
        description: 'Сотрудник с должностями, регионами и гражданством из справочников.'
      },
      createRevisor: {
        title: 'Принять ревизора',
        description: 'Ревизор с категорией; справочники — как у офисного.'
      },
      rename: {
        title: 'Переименовать сотрудника',
        description: 'Точечный патч одного поля.'
      },
      fire: {
        title: 'Уволить сотрудника',
        description: 'Статус `fired`; уволенный не увольняется повторно и не может быть актором.'
      }
    }
  },
  clients: {
    title: 'Клиенты',
    description: 'Клиенты с менеджером из офиса.',
    methods: {
      create: {
        title: 'Завести клиента',
        description: 'Менеджер — работающий офисный сотрудник.'
      },
      remove: {
        title: 'Удалить клиента',
        description: 'Клиента с проектами не даст удалить схема: ссылка проекта — `restrict`.'
      }
    }
  },
  projects: {
    title: 'Проекты',
    description: 'Проекты клиентов и их кадровики.',
    methods: {
      create: {
        title: 'Открыть проект',
        description: 'Проект клиента в стадии `active`; кадровики проверяются до выдачи номера.'
      },
      complete: {
        title: 'Завершить проект',
        description: 'Когда ни одна смена проекта не ждёт набора или проведения.'
      }
    }
  },
  shifts: {
    title: 'Смены',
    description: 'Смены проектов: набор участников, явка и начисления.',
    methods: {
      create: {
        title: 'Создать смену',
        description: 'Смена активного проекта в стадии `created` с пустым составом.'
      },
      launchRecruiting: {
        title: 'Запустить набор',
        description: 'Переход `created → recruiting`; ставка должна быть задана.'
      },
      addParticipant: {
        title: 'Добавить участника',
        description: 'Работающий сотрудник, которого ещё нет в этой смене.'
      },
      withdraw: {
        title: 'Снять участника',
        description: 'До завершения смены; ссылка из состава уходит сама.'
      },
      setAttendance: {
        title: 'Отметить явку',
        description: 'У смены в наборе; завершение требует явку у всех.'
      },
      complete: {
        title: 'Завершить смену',
        description: 'Начисления по явке, итоги — в `stats`.'
      },
      cancel: {
        title: 'Отменить смену',
        description: 'С причиной — до завершения.'
      }
    }
  }
}
