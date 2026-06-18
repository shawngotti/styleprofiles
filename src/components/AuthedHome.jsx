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
import AdminConsole from './AdminConsole.jsx'
import Deals from './Deals.jsx'
import EmailPrefToggle from './EmailPrefToggle.jsx'
import ProfileViewsToggle from './ProfileViewsToggle.jsx'
import LandingPage from './LandingPage.jsx'
import LineupBand from './LineupBand.jsx'
import { useSettings } from '../lib/useSettings.js'
import { track } from '../lib/analytics.js'

const GOLD = '#0FB9A6'

// Map roles -> available perspectives. Every signed-in user has 'client'.
// The switcher is a VIEW convenience only; RLS is the real boundary.
const PERSPECTIVES = [
  { key: 'client', label: 'Client', role: 'client' },
  { key: 'pro', label: 'Pro', role: 'pro' },
  { key: 'admin', label: 'Admin', role: 'admin' },
]

export default function AuthedHome() {
  const { user, roles, signOut } = useAuth()
  const { lineupOn, shopVisible, lineupVisible, shopDemoOnly, lineupDemoOnly, heroVideoUrl, heroPosterUrl } = useSettings()

  const available = useMemo(
    () => PERSPECTIVES.filter((p) => roles.includes(p.role)),
    [roles],
  )
  const [perspective, setPerspective] = useState('client')
  const [selectedPro, setSelectedPro] = useState(null) // { pro, color }
  const [clientTab, setClientTab] = useState('discover') // 'discover' | 'appointments'
  const [previewLanding, setPreviewLanding] = useState(false)
  const [previewPro, setPreviewPro] = useState(null) // a pro previewing their own public profile
  const [adminView, setAdminView] = useState('console') // 'console' | 'browse'

  // Preview the public marketing landing without signing out.
  if (previewLanding) {
    return (
      <div className="relative">
        <button
          onClick={() => setPreviewLanding(false)}
          className="fixed left-4 top-4 z-50 rounded-full px-4 py-2 text-sm font-semibold text-black shadow-lg"
          style={{ backgroundColor: GOLD }}
        >
          ← Back to app
        </button>
        <LandingPage onGetStarted={() => setPreviewLanding(false)} onSignIn={() => setPreviewLanding(false)} />
      </div>
    )
  }

  // A pro previewing their own public storefront (exactly what a client sees),
  // without leaving the dashboard.
  if (previewPro) {
    return (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between rounded-xl border border-black/10 bg-black/5 px-4 py-2 text-sm">
            <span className="text-black/60">👁 Previewing your public profile</span>
            <button
              onClick={() => setPreviewPro(null)}
              className="rounded-lg px-3 py-1.5 font-semibold text-black"
              style={{ backgroundColor: GOLD }}
            >
              ← Back to dashboard
            </button>
          </div>
          <ProProfile pro={previewPro} onBack={() => setPreviewPro(null)} />
        </div>
      </div>
    )
  }

  // Central place a pro storefront opens — instrument the conversion funnel
  // (e.g. contestant profile -> book) from one spot.
  const openPro = (pro, color, source) => {
    track('pro_profile_open', { pro_id: pro?.id, source })
    setSelectedPro({ pro, color, source })
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <h1 className="text-xl font-semibold">
          Style<span style={{ color: GOLD }}>Profiles</span>
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-black/60 sm:inline">{user?.email}</span>
          <NotificationsBell
            lineupOn={lineupOn}
            onNavigate={(screen) => {
              // Pro-only destinations switch to the pro perspective.
              if (screen === 'fillchair' || screen === 'dashboard') {
                setPerspective('pro')
                return
              }
              setPerspective('client')
              if (['discover', 'deals', 'appointments', 'rewards', 'awards', 'household', 'lineup', 'cotw', 'shop', 'tags'].includes(screen)) {
                setSelectedPro(null)
                setClientTab(screen)
              }
            }}
          />
          <button
            onClick={signOut}
            className="rounded-lg border border-black/15 px-3 py-1.5 hover:bg-black/10"
          >
            Sign out
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto mt-10 max-w-3xl space-y-6">
        {/* Perspective switcher — only shows perspectives the user's roles allow */}
        <section className="rounded-2xl border border-black/10 bg-black/5 p-5">
          <p className="text-xs uppercase tracking-wide text-black/55">Perspective</p>
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
                      : { backgroundColor: 'rgba(0,0,0,0.06)', color: '#1f1714' }
                  }
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          {available.length === 1 && (
            <p className="mt-3 text-xs text-black/55">
              You have the <strong>client</strong> role only. Pro and Admin perspectives
              appear here once those roles are granted.
            </p>
          )}
        </section>

        {/* Admin can browse the live client experience without leaving admin. */}
        {perspective === 'admin' && (
          <div className="inline-flex rounded-full border border-black/10 p-0.5">
            {[['console', 'Console'], ['browse', 'Browse site']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setAdminView(k)}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition"
                style={adminView === k ? { backgroundColor: GOLD, color: '#000' } : { color: '#1f1714' }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Client experience (also shown to admins in Browse mode). */}
        {(perspective === 'client' || (perspective === 'admin' && adminView === 'browse')) && (
          <section>
            {selectedPro ? (
              <ProProfile
                pro={selectedPro.pro}
                catColor={selectedPro.color}
                logSource={selectedPro.source}
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
                    ['deals', 'Deals'],
                    ['appointments', 'My Appointments'],
                    ['rewards', 'Rewards'],
                    ['awards', 'Awards'],
                    ['tags', 'Tag requests'],
                    ['household', 'Household'],
                    ...(lineupVisible ? [['lineup', 'The Lineup'], ...(lineupOn ? [['cotw', 'Cut of the Week']] : [])] : []),
                    ...(shopVisible ? [['shop', 'Shop']] : []),
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setClientTab(key)}
                      className="rounded-full px-4 py-1.5 text-sm font-medium transition"
                      style={
                        clientTab === key
                          ? { backgroundColor: GOLD, color: '#000' }
                          : { backgroundColor: 'rgba(0,0,0,0.06)', color: '#1f1714' }
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {clientTab === 'discover' && (
                  <>
                    <Discover
                      onOpenPro={(pro, color) => openPro(pro, color, 'discover')}
                      heroVideoUrl={heroVideoUrl}
                      heroPosterUrl={heroPosterUrl}
                    />
                    {lineupVisible && <LineupBand demo={lineupDemoOnly} onOpen={() => setClientTab('lineup')} />}
                  </>
                )}
                {clientTab === 'appointments' && (
                  <MyAppointments onRebook={(pro) => setSelectedPro({ pro, color: GOLD })} />
                )}
                {clientTab === 'rewards' && <Rewards />}
                {clientTab === 'awards' && <Awards />}
                {clientTab === 'deals' && (
                  <Deals onClaimed={() => setClientTab('appointments')} />
                )}
                {clientTab === 'tags' && <ConsentRequests />}
                {clientTab === 'household' && <HouseholdManager />}
                {clientTab === 'lineup' && lineupVisible && (
                  <Lineup demo={lineupDemoOnly} onOpenPro={(pro, color) => openPro(pro, color, 'lineup')} />
                )}
                {clientTab === 'cotw' && lineupOn && <CutOfTheWeek />}
                {clientTab === 'shop' && shopVisible && <Shop demo={shopDemoOnly} />}
              </>
            )}
          </section>
        )}
        {perspective === 'pro' && <ProDashboard onPreviewProfile={setPreviewPro} />}
        {perspective === 'admin' && adminView === 'console' && (
          <AdminConsole
            onOpenPro={(pro, color) => {
              setAdminView('browse')
              setClientTab('discover')
              openPro(pro, color, 'admin')
            }}
          />
        )}

        <section className="rounded-2xl border border-black/10 bg-black/5 p-5">
          <p className="text-xs uppercase tracking-wide text-black/55">Your account</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-black/50">User ID</dt>
              <dd className="font-mono text-xs">{user?.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-black/50">Roles</dt>
              <dd className="flex gap-1.5">
                {roles.length ? (
                  roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs"
                      style={{ color: GOLD }}
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-black/55">none</span>
                )}
              </dd>
            </div>
            <EmailPrefToggle />
            <ProfileViewsToggle />
          </dl>
          <button onClick={() => setPreviewLanding(true)} className="mt-4 text-sm underline" style={{ color: GOLD }}>
            Preview the landing page →
          </button>
        </section>
      </main>
    </div>
  )
}
