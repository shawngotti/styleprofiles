import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'

export default function LoginScreen({ initialMode = 'signin', onBack }) {
  const [mode, setMode] = useState(initialMode) // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'error' | 'info', text }

  async function handleEmail(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)

    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    if (mode === 'signup') track('signup', { method: 'email' })
    // If email confirmations are ON, signUp returns no session until confirmed.
    if (mode === 'signup' && !data.session) {
      setMsg({ type: 'info', text: 'Account created. Check your email to confirm, then sign in.' })
    }
    // On success with a session, AuthProvider's listener takes over.
  }

  async function handleGoogle() {
    setMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setMsg({ type: 'error', text: error.message })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8">
        {onBack && (
          <button onClick={onBack} className="mb-4 text-sm text-white/50 hover:text-white/80">
            ← Back
          </button>
        )}
        <h1 className="text-center text-3xl font-semibold">
          Style<span style={{ color: GOLD }}>Profiles</span>
        </h1>
        <p className="mt-1 text-center text-sm text-white/60">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </p>

        <button
          onClick={handleGoogle}
          className="mt-6 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/15 transition"
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-white/55">
          <div className="h-px flex-1 bg-white/10" />
          or
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
            style={{ backgroundColor: GOLD }}
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        {msg && (
          <p
            className={`mt-4 text-center text-xs ${
              msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {msg.text}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-white/50">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setMsg(null)
            }}
            className="font-medium underline"
            style={{ color: GOLD }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
