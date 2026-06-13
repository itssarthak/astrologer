import { useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProfilesContext } from './contexts/ProfilesContext'
import { useApiKey } from './hooks/useApiKey'
import Onboarding from './pages/Onboarding'
import MainApp from './pages/MainApp'

// Setup is complete when there's at least one profile, an active one, and an API key.
// Reads from ProfilesContext + useApiKey so the guards re-render when any of these change
// (e.g. the user clears their key from the sidebar while on /app).
function useIsSetUp() {
  const { profiles, activeProfileId } = useContext(ProfilesContext)
  const key = useApiKey()
  return profiles.length > 0 && !!activeProfileId && !!key
}

function RequireSetup({ children }) {
  return useIsSetUp() ? children : <Navigate to="/onboarding" replace />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/app" element={<RequireSetup><MainApp /></RequireSetup>} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

function RootRedirect() {
  return <Navigate to={useIsSetUp() ? '/app' : '/onboarding'} replace />
}
