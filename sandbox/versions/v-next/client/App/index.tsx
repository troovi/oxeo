import { Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { AppFrame, AppPage } from '../../../../app/kit'
import { AppKeys } from '../../core/keys'
import { ClientPage } from './ClientPage'
import { ClientsPage } from './ClientsPage'
import { DictionariesPage } from './DictionariesPage'
import { DictionaryPage } from './DictionaryPage'
import { HomePage } from './HomePage'
import { paths } from './paths'
import { ProjectPage } from './ProjectPage'
import { ProjectsPage } from './ProjectsPage'
import { ShiftPage } from './ShiftPage'
import { ShiftsPage } from './ShiftsPage'
import { WorkerPage } from './WorkerPage'
import { WorkersPage } from './WorkersPage'

/**
 * Маршруты приложения под префиксом версии: корень — главная, раздел — полный список, `/<раздел>/:id` —
 * запись. Разделы — в строке окна приложения. У смен сегменты стадий — свои маршруты `/shifts/<stage>`:
 * статический путь сегмента выигрывает у пути записи.
 */
const router = createBrowserRouter(
  [
    {
      element: (
        <AppFrame
          nav={[
            { to: paths.home, title: 'Главная' },
            { to: paths.workers, title: 'Сотрудники' },
            { to: paths.clients, title: 'Клиенты' },
            { to: paths.projects, title: 'Проекты' },
            { to: paths.shifts, title: 'Смены' },
            { to: paths.dictionaries, title: 'Справочники' }
          ]}
        >
          <Outlet />
        </AppFrame>
      ),
      children: [
        { index: true, element: <HomePage /> },
        { path: 'workers', element: <WorkersPage /> },
        { path: 'workers/:workerId', element: <WorkerPage /> },
        { path: 'clients', element: <ClientsPage /> },
        { path: 'clients/:clientId', element: <ClientPage /> },
        { path: 'projects', element: <ProjectsPage /> },
        { path: 'projects/:projectId', element: <ProjectPage /> },
        { path: 'shifts', element: <ShiftsPage /> },
        ...AppKeys.ShiftStage.map((stage) => ({
          path: `shifts/${stage}`,
          element: <ShiftsPage stage={stage} />
        })),
        { path: 'shifts/:shiftId', element: <ShiftPage /> },
        { path: 'dictionaries', element: <DictionariesPage /> },
        { path: 'dictionaries/:dictionary', element: <DictionaryPage /> },
        { path: '*', element: <AppPage.Empty>Такой страницы в приложении нет</AppPage.Empty> }
      ]
    }
  ],
  { basename: '/v-next' }
)

/** Клиентское приложение версии: страницы списков и записей на react-router, данные — хуки реплики. */
export const App = () => {
  return <RouterProvider router={router} />
}
