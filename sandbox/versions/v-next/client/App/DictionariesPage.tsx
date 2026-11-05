import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { data, observer } from '../data'
import { paths } from './paths'

/** Все справочники; строка ведёт в справочник с его значениями. */
export const DictionariesPage = observer(() => {
  const navigate = useNavigate()

  const dictionaries = data.dictionary.all()

  return (
    <AppPage title="Справочники" aside={dictionaries.length}>
      <RecordsTable
        rows={dictionaries}
        onRowClick={(dictionary) => navigate(paths.dictionary(dictionary.dictionary))}
      />
    </AppPage>
  )
})
