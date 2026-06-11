import { BrowserRouter } from 'react-router-dom'
import { ProfilesProvider } from './contexts/ProfilesContext'
import { PyodideProvider } from './contexts/PyodideContext'
import RouteTracker from './components/RouteTracker'
import AppRouter from './router'

export default function App() {
  return (
    <BrowserRouter>
      <RouteTracker />
      <ProfilesProvider>
        <PyodideProvider>
          <AppRouter />
        </PyodideProvider>
      </ProfilesProvider>
    </BrowserRouter>
  )
}
