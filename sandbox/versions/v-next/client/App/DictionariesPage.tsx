import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/** Все справочники; строка ведёт в справочник с его значениями. */
export const DictionariesPage = () => {
  const navigate = useNavigate()

  const state = useDb((db) => db.dictionary.all())

  return (
    <AppPage title="Справочники" aside={state.data?.length}>
      {state.stage === 'success' ? (
        <RecordsTable
          rows={state.data}
          onRowClick={(dictionary) => navigate(paths.dictionary(dictionary.dictionary))}
        />
      ) : (
        <LoadState state={state} />
      )}
    </AppPage>
  )
}
