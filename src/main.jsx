import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { setErrorMonitor } from './lib/analytics.js'

// Error monitoring is opt-in: only when VITE_SENTRY_DSN is set do we load Sentry
// (dynamic import → no bundle cost otherwise) and wire it into reportError.
const dsn = import.meta.env.VITE_SENTRY_DSN
if (dsn) {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({ dsn, tracesSampleRate: 0.1, environment: import.meta.env.MODE })
      setErrorMonitor(Sentry)
    })
    .catch(() => {
      /* monitoring is best-effort */
    })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
