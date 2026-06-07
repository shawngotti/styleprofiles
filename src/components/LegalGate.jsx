import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'

// Gates the app on acceptance of the current Terms + Privacy versions. Required
// versions live in platform_settings so legal can bump them without a deploy;
// when they change, users are re-prompted. Acceptances are recorded per version
// (legal_acceptances) for auditable proof of consent.
export default function LegalGate({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState('loading') // loading | needed | ok
  const [versions, setVersions] = useState({ tos: null, privacy: null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const checkAcceptance = useCallback(async () => {
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key,value')
      .in('key', ['legal_tos_version', 'legal_privacy_version'])
    const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]))
    const tos = map.legal_tos_version
    const privacy = map.legal_privacy_version
    setVersions({ tos, privacy })
    if (!tos || !privacy) {
      // No required versions configured -> don't block.
      setState('ok')
      return
    }
    const { data: accepted } = await supabase
      .from('legal_acceptances')
      .select('doc,version')
      .eq('profile_id', user.id)
    const has = (doc, v) => (accepted || []).some((a) => a.doc === doc && a.version === v)
    setState(has('tos', tos) && has('privacy', privacy) ? 'ok' : 'needed')
  }, [user.id])

  useEffect(() => {
    checkAcceptance()
  }, [checkAcceptance])

  async function accept() {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('legal_acceptances').insert([
      { profile_id: user.id, doc: 'tos', version: versions.tos },
      { profile_id: user.id, doc: 'privacy', version: versions.privacy },
    ])
    setBusy(false)
    if (err && err.code !== '23505') {
      setError(err.message)
      return
    }
    track('legal_accepted', { tos: versions.tos, privacy: versions.privacy })
    setState('ok')
  }

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-sm text-white/50">Loading…</div>
  }
  if (state === 'ok') return children

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-lg font-semibold">
          Before you continue
        </h1>
        <p className="mt-3 text-sm text-white/70">
          Please review and accept our updated Terms and Privacy Policy. They cover bookings and
          deposits, payments, StylePoints, how your photos and consent work, and the rules for Awards
          and The Lineup.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm">
          <li>
            <a className="underline" style={{ color: GOLD }} href="https://github.com" target="_blank" rel="noreferrer">
              Terms of Service
            </a>{' '}
            <span className="text-white/40">(v{versions.tos})</span>
          </li>
          <li>
            <a className="underline" style={{ color: GOLD }} href="https://github.com" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>{' '}
            <span className="text-white/40">(v{versions.privacy})</span>
          </li>
        </ul>
        {error && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          onClick={accept}
          disabled={busy}
          className="mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
          style={{ backgroundColor: GOLD, outlineColor: GOLD }}
        >
          {busy ? 'Saving…' : 'I agree to the Terms & Privacy Policy'}
        </button>
        <p className="mt-3 text-xs text-white/40">
          You can withdraw media consent at any time from Tag requests. Accepting is required to use
          StyleProfiles.
        </p>
      </div>
    </main>
  )
}
