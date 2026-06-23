import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import { initAnalytics } from './lib/analytics'
import { initServiceWorkerAutoUpdate } from './lib/registerSwUpdate'
import App from './App'

initAnalytics()
initServiceWorkerAutoUpdate()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
