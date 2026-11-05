import { useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { AppKey } from '../../core/keys'
import { data, observer } from '../data'
import { paths } from './paths'

/** Запись справочника: поля и значения. */
export const DictionaryPage = observer(() => {
  const params = useParams()

  const key = params.dictionary as AppKey.Dictionary

  const dictionary = data.dictionary.get(key)
  const options = data.option.find({ dictionary: key })

  if (!dictionary) {
    return <AppPage.Empty>Справочника {params.dictionary} нет</AppPage.Empty>
  }

  return (
    <AppPage title={dictionary.name} back={{ to: paths.dictionaries, title: 'Справочники' }}>
      <RecordFields record={dictionary} />
      <AppPage.Section title={`Значения · ${options.length}`}>
        <RecordsTable rows={options} />
      </AppPage.Section>
    </AppPage>
  )
})
