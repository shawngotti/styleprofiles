import { AuthProvider, useAuth } from './auth/AuthProvider.jsx'
import LoginScreen from './auth/LoginScreen.jsx'
import AuthedHome from './components/AuthedHome.jsx'

function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-white/50">
        Loading…
      </div>
    )
  }
  return session ? <AuthedHome /> : <LoginScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
