import { AppPage } from '../../../../app/kit'
import type { DbState } from '../../lib/client'

/** То, что страница рисует, пока данных нет: загрузка или вид ошибки с повтором. */
export const LoadState = ({ state }: { state: DbState<unknown> }) => {
  if (state.stage === 'error') {
    return <AppPage.Failed onRetry={state.retry} />
  }

  return <AppPage.Loading />
}
