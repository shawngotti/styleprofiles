import { AuthProvider, useAuth } from './auth/AuthProvider.jsx'
import LoginScreen from './auth/LoginScreen.jsx'
import AuthedHome from './components/AuthedHome.jsx'
import LegalGate from './components/LegalGate.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-white/50">
        Loading…
      </div>
    )
  }
  if (!session) return <LoginScreen />
  return (
    <LegalGate>
      <AuthedHome />
    </LegalGate>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-black"
      >
        Skip to content
      </a>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ErrorBoundary>
  )
}
