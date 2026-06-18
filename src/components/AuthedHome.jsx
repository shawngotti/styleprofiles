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
import AccountMenu from './AccountMenu.jsx'
import AdminConsole from './AdminConsole.jsx'
import Deals from './Deals.jsx'
import LandingPage from './LandingPage.jsx'
import LineupBracket from './LineupBracket.jsx'
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
          <div className="mb-4 flex items-center justify-between rounded-xl border border-black/[0.06] bg-white shadow-sm px-4 py-2 text-sm">
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

  const CLIENT_TABS = [
    ['discover', 'Discover'],
    ['deals', 'Deals'],
    ['appointments', 'My Appointments'],
    ['rewards', 'Rewards'],
    ['awards', 'Awards'],
    ['tags', 'Tag requests'],
    ['household', 'Household'],
    ...(lineupVisible ? [['lineup', 'The Lineup'], ...(lineupOn ? [['cotw', 'Cut of the Week']] : [])] : []),
    ...(shopVisible ? [['shop', 'Shop']] : []),
  ]
  const showClient = perspective === 'client' || (perspective === 'admin' && adminView === 'browse')
  const goClient = (screen) => {
    if (screen === 'fillchair' || screen === 'dashboard') { setPerspective('pro'); return }
    setPerspective('client')
    if (CLIENT_TABS.some(([k]) => k === screen) || screen === 'tags') {
      setSelectedPro(null)
      setClientTab(screen)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            onClick={() => { setPerspective('client'); setClientTab('discover'); setSelectedPro(null) }}
            className="text-xl font-semibold"
          >
            Style<span style={{ color: GOLD }}>Profiles</span>
          </button>
          <div className="flex items-center gap-2">
            <NotificationsBell lineupOn={lineupOn} onNavigate={goClient} />
            <AccountMenu
              user={user}
              perspectives={available}
              perspective={perspective}
              setPerspective={(p) => { setPerspective(p); setSelectedPro(null) }}
              onPreviewLanding={() => setPreviewLanding(true)}
              signOut={signOut}
            />
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        {/* Admin can browse the live client experience without leaving admin. */}
        {perspective === 'admin' && (
          <div className="mt-5 inline-flex rounded-full border border-black/10 p-0.5">
            {[['console', 'Console'], ['browse', 'Browse site']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setAdminView(k)}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition"
                style={adminView === k ? { backgroundColor: GOLD, color: '#06403a' } : { color: '#1f1714' }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Client experience (also shown to admins in Browse mode). */}
        {showClient && (
          selectedPro ? (
            <div className="mt-5">
              <ProProfile
                pro={selectedPro.pro}
                catColor={selectedPro.color}
                logSource={selectedPro.source}
                onBack={() => setSelectedPro(null)}
                onBooked={() => { setSelectedPro(null); setClientTab('appointments') }}
              />
            </div>
          ) : (
            <>
              <nav className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Sections">
                {CLIENT_TABS.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setClientTab(key)}
                    className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition"
                    style={clientTab === key ? { backgroundColor: GOLD, color: '#06403a' } : { backgroundColor: 'rgba(0,0,0,0.05)', color: '#1f1714' }}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {clientTab === 'discover' && (
                <>
                  <Discover
                    onOpenPro={(pro, color) => openPro(pro, color, 'discover')}
                    heroVideoUrl={heroVideoUrl}
                    heroPosterUrl={heroPosterUrl}
                  />
                  {lineupVisible && <LineupBracket demo={lineupDemoOnly} onOpen={() => setClientTab('lineup')} />}
                </>
              )}
              {clientTab === 'appointments' && <div className="mt-5"><MyAppointments onRebook={(pro) => setSelectedPro({ pro, color: GOLD })} /></div>}
              {clientTab === 'rewards' && <div className="mt-5"><Rewards /></div>}
              {clientTab === 'awards' && <div className="mt-5"><Awards /></div>}
              {clientTab === 'deals' && <div className="mt-5"><Deals onClaimed={() => setClientTab('appointments')} /></div>}
              {clientTab === 'tags' && <div className="mt-5"><ConsentRequests /></div>}
              {clientTab === 'household' && <div className="mt-5"><HouseholdManager /></div>}
              {clientTab === 'lineup' && lineupVisible && <div className="mt-5"><Lineup demo={lineupDemoOnly} onOpenPro={(pro, color) => openPro(pro, color, 'lineup')} /></div>}
              {clientTab === 'cotw' && lineupOn && <div className="mt-5"><CutOfTheWeek /></div>}
              {clientTab === 'shop' && shopVisible && <div className="mt-5"><Shop demo={shopDemoOnly} /></div>}
            </>
          )
        )}

        {perspective === 'pro' && <div className="mt-6"><ProDashboard onPreviewProfile={setPreviewPro} /></div>}
        {perspective === 'admin' && adminView === 'console' && (
          <div className="mt-5">
            <AdminConsole onOpenPro={(pro, color) => { setAdminView('browse'); setClientTab('discover'); openPro(pro, color, 'admin') }} />
          </div>
        )}
      </main>
    </div>
  )
}
