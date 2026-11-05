import { useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { AppKey } from '../../core/keys'
import { useEntity, useFindBy } from '../data'
import { paths } from './paths'

/** Запись справочника: поля и значения, свежие сверху. */
export const DictionaryPage = () => {
  const params = useParams()

  const key = params.dictionary as AppKey.Dictionary

  const dictionary = useEntity('dictionary', key)
  const options = useFindBy('option', { dictionary: key })

  if (!dictionary) {
    return <AppPage.Empty>Справочника {params.dictionary} нет в локальной базе</AppPage.Empty>
  }

  return (
    <AppPage title={dictionary.name} back={{ to: paths.dictionaries, title: 'Справочники' }}>
      <RecordFields record={dictionary} />
      <AppPage.Section title={`Значения · ${options.length}`}>
        <RecordsTable rows={[...options].reverse()} />
      </AppPage.Section>
    </AppPage>
  )
}
