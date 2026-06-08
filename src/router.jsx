import { Routes, Route, Navigate } from 'react-router-dom'
import { getProfiles, getActiveProfileId } from './lib/storage/profiles'
import { getApiKey } from './lib/storage/keys'
import Onboarding from './pages/Onboarding'
import MainApp from './pages/MainApp'

function RequireSetup({ children }) {
  const profiles = getProfiles()
  const activeId = getActiveProfileId()
  const key = getApiKey()
  if (profiles.length > 0 && activeId && key) return children
  return <Navigate to="/onboarding" replace />
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
  const profiles = getProfiles()
  const activeId = getActiveProfileId()
  const key = getApiKey()
  if (profiles.length > 0 && activeId && key) return <Navigate to="/app" replace />
  return <Navigate to="/onboarding" replace />
}
