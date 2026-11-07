import { useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { AppKey } from '../../core/keys'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/** Вход маршрута: другой справочник — новый экземпляр записи, иначе до ответа был бы виден прежний. */
export const DictionaryPage = () => {
  const { dictionary } = useParams()

  return <DictionaryRecord key={dictionary} dictionaryKey={dictionary as AppKey.Dictionary} />
}

/** Запись справочника: поля и значения. */
const DictionaryRecord = ({ dictionaryKey }: { dictionaryKey: AppKey.Dictionary }) => {
  const state = useDb((db) => {
    return {
      dictionary: db.dictionary.get(dictionaryKey),
      options: db.option.find({ dictionary: dictionaryKey })
    }
  })

  if (state.stage !== 'success') {
    return <LoadState state={state} />
  }

  const { dictionary, options } = state.data

  if (!dictionary) {
    return <AppPage.Empty>Справочника {dictionaryKey} нет</AppPage.Empty>
  }

  return (
    <AppPage title={dictionary.name} back={{ to: paths.dictionaries, title: 'Справочники' }}>
      <RecordFields record={dictionary} />
      <AppPage.Section title={`Значения · ${options.length}`}>
        <RecordsTable rows={options} />
      </AppPage.Section>
    </AppPage>
  )
}
