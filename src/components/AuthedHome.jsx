import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import Discover from './Discover.jsx'
import ProProfile from './ProProfile.jsx'
import MyAppointments from './MyAppointments.jsx'
import HouseholdManager from './HouseholdManager.jsx'
import ProDashboard from './ProDashboard.jsx'
import Rewards from './Rewards.jsx'
import Awards from './Awards.jsx'
import Shop from './Shop.jsx'
import Lineup from './Lineup.jsx'
import CutOfTheWeek from './CutOfTheWeek.jsx'
import ConsentRequests from './ConsentRequests.jsx'
import NotificationsBell from './NotificationsBell.jsx'
import { useSettings } from '../lib/useSettings.js'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'

// Map roles -> available perspectives. Every signed-in user has 'client'.
// The switcher is a VIEW convenience only; RLS is the real boundary.
const PERSPECTIVES = [
  { key: 'client', label: 'Client', role: 'client' },
  { key: 'pro', label: 'Pro', role: 'pro' },
  { key: 'admin', label: 'Admin', role: 'admin' },
]

export default function AuthedHome() {
  const { user, roles, signOut } = useAuth()
  const { marketplaceOn, lineupOn } = useSettings()

  const available = useMemo(
    () => PERSPECTIVES.filter((p) => roles.includes(p.role)),
    [roles],
  )
  const [perspective, setPerspective] = useState('client')
  const [selectedPro, setSelectedPro] = useState(null) // { pro, color }
  const [clientTab, setClientTab] = useState('discover') // 'discover' | 'appointments'

  // Central place a pro storefront opens — instrument the conversion funnel
  // (e.g. contestant profile -> book) from one spot.
  const openPro = (pro, color, source) => {
    track('pro_profile_open', { pro_id: pro?.id, source })
    setSelectedPro({ pro, color })
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <div className="text-xl font-semibold">
          Style<span style={{ color: GOLD }}>Profiles</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-white/60 sm:inline">{user?.email}</span>
          <NotificationsBell
            lineupOn={lineupOn}
            onNavigate={(screen) => {
              setPerspective('client')
              const tab = screen === 'dashboard' ? null : screen
              if (tab && ['discover', 'appointments', 'rewards', 'awards', 'household', 'lineup', 'cotw', 'shop', 'tags'].includes(tab)) {
                setSelectedPro(null)
                setClientTab(tab)
              }
            }}
          />
          <button
            onClick={signOut}
            className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto mt-10 max-w-3xl space-y-6">
        {/* Perspective switcher — only shows perspectives the user's roles allow */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-wide text-white/40">Perspective</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {available.map((p) => {
              const active = p.key === perspective
              return (
                <button
                  key={p.key}
                  onClick={() => setPerspective(p.key)}
                  className="rounded-full px-4 py-1.5 text-sm font-medium transition"
                  style={
                    active
                      ? { backgroundColor: GOLD, color: '#000' }
                      : { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' }
                  }
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          {available.length === 1 && (
            <p className="mt-3 text-xs text-white/40">
              You have the <strong>client</strong> role only. Pro and Admin perspectives
              appear here once those roles are granted.
            </p>
          )}
        </section>

        {/* Client perspective: Discover + My Appointments. */}
        {perspective === 'client' && (
          <section>
            {selectedPro ? (
              <ProProfile
                pro={selectedPro.pro}
                catColor={selectedPro.color}
                onBack={() => setSelectedPro(null)}
                onBooked={() => {
                  setSelectedPro(null)
                  setClientTab('appointments')
                }}
              />
            ) : (
              <>
                <div className="mb-4 flex gap-2">
                  {[
                    ['discover', 'Discover'],
                    ['appointments', 'My Appointments'],
                    ['rewards', 'Rewards'],
                    ['awards', 'Awards'],
                    ['tags', 'Tag requests'],
                    ['household', 'Household'],
                    ...(lineupOn ? [['lineup', 'The Lineup'], ['cotw', 'Cut of the Week']] : []),
                    ...(marketplaceOn ? [['shop', 'Shop']] : []),
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setClientTab(key)}
                      className="rounded-full px-4 py-1.5 text-sm font-medium transition"
                      style={
                        clientTab === key
                          ? { backgroundColor: GOLD, color: '#000' }
                          : { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' }
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {clientTab === 'discover' && (
                  <Discover onOpenPro={(pro, color) => openPro(pro, color, 'discover')} />
                )}
                {clientTab === 'appointments' && (
                  <MyAppointments onRebook={(pro) => setSelectedPro({ pro, color: GOLD })} />
                )}
                {clientTab === 'rewards' && <Rewards />}
                {clientTab === 'awards' && <Awards />}
                {clientTab === 'tags' && <ConsentRequests />}
                {clientTab === 'household' && <HouseholdManager />}
                {clientTab === 'lineup' && lineupOn && (
                  <Lineup onOpenPro={(pro, color) => openPro(pro, color, 'lineup')} />
                )}
                {clientTab === 'cotw' && lineupOn && <CutOfTheWeek />}
                {clientTab === 'shop' && marketplaceOn && <Shop />}
              </>
            )}
          </section>
        )}
        {perspective === 'pro' && <ProDashboard />}
        {perspective === 'admin' && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/50">
            The <strong className="text-white/70">admin</strong> console is built in a later batch.
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-wide text-white/40">Your account</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-white/50">User ID</dt>
              <dd className="font-mono text-xs">{user?.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/50">Roles</dt>
              <dd className="flex gap-1.5">
                {roles.length ? (
                  roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-black/40 px-2.5 py-0.5 text-xs"
                      style={{ color: GOLD }}
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-white/40">none</span>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-white/40">
            Viewing as <strong className="text-white/70">{perspective}</strong>. This is the
            auth foundation (Batch 6); the prototype screens migrate on top of it next.
          </p>
        </section>
      </main>
    </div>
  )
}
