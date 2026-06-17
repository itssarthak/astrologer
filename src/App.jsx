import { BrowserRouter } from 'react-router-dom'
import { ProfilesProvider } from './contexts/ProfilesContext'
import { PyodideProvider } from './contexts/PyodideContext'
import RouteTracker from './components/RouteTracker'
import StorageGate from './components/StorageGate'
import ProfileMigration from './hooks/useProfileMigration'
import AppRouter from './router'

export default function App() {
  return (
    <BrowserRouter>
      <RouteTracker />
      {/* Hydrate the IndexedDB-backed storage cache before any storage-reading provider mounts. */}
      <StorageGate>
        <ProfilesProvider>
          <PyodideProvider>
            <ProfileMigration />
            <AppRouter />
          </PyodideProvider>
        </ProfilesProvider>
      </StorageGate>
    </BrowserRouter>
  )
}
