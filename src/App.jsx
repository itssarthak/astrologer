import { BrowserRouter } from 'react-router-dom'
import { ProfilesProvider } from './contexts/ProfilesContext'
import { PyodideProvider } from './contexts/PyodideContext'
import AppRouter from './router'

export default function App() {
  return (
    <BrowserRouter>
      <ProfilesProvider>
        <PyodideProvider>
          <AppRouter />
        </PyodideProvider>
      </ProfilesProvider>
    </BrowserRouter>
  )
}
