import { BrowserRouter } from 'react-router-dom'
import { ProfilesProvider } from './contexts/ProfilesContext'
import { PyodideProvider } from './contexts/PyodideContext'
import RouteTracker from './components/RouteTracker'
import ProfileMigration from './hooks/useProfileMigration'
import AppRouter from './router'

export default function App() {
  return (
    <BrowserRouter>
      <RouteTracker />
      <ProfilesProvider>
        <PyodideProvider>
          <ProfileMigration />
          <AppRouter />
        </PyodideProvider>
      </ProfilesProvider>
    </BrowserRouter>
  )
}
