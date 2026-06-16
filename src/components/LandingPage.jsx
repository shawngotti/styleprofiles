// Bright, pro-focused marketing landing page — the public "front door" shown to
// logged-out visitors. Intentionally light/cheerful (Booksy-style) and on its own
// palette, independent of the dark in-app theme. CTAs hand off to the auth screen.
const GOLD = '#F4A93C'
const PINK = '#FF6FA5'
const TEAL = '#2DD4BF'
const INK = '#1f1714'

function Stat({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold sm:text-3xl" style={{ color: INK }}>{value}</div>
      <div className="mt-1 text-sm text-black/55">{label}</div>
    </div>
  )
}

function Feature({ color, emoji, title, body }) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: `${color}22` }}>
        <span aria-hidden>{emoji}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold" style={{ color: INK }}>{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-black/60">{body}</p>
    </div>
  )
}

export default function LandingPage({ onGetStarted, onSignIn }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFBF5', color: INK }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#FFFBF5]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="text-xl font-extrabold tracking-tight">
            Style<span style={{ color: GOLD }}>Profiles</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={onSignIn} className="rounded-full px-4 py-2 font-medium text-black/70 hover:bg-black/5">
              Sign in
            </button>
            <button onClick={onGetStarted} className="rounded-full px-4 py-2 font-semibold text-black shadow-sm" style={{ backgroundColor: GOLD }}>
              Start free
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:py-20 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${PINK}1f`, color: '#C13B73' }}>
            ✨ For barbers, stylists, nail &amp; lash artists
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Get booked. Get paid.{' '}
            <span style={{ color: GOLD }}>Get famous.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-black/60">
            The booking app that also grows your name — appointments with deposits, loyalty that brings
            clients back, and monthly awards that put you on the map.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button onClick={onGetStarted} className="rounded-full px-6 py-3 text-base font-semibold text-black shadow-md transition hover:brightness-95" style={{ backgroundColor: GOLD }}>
              Start free now
            </button>
            <span className="text-sm text-black/50">{/* TODO: confirm offer */}Free to try · no card required</span>
          </div>
        </div>

        {/* Stylized app preview (no stock photos needed) */}
        <div className="relative mx-auto h-[360px] w-full max-w-sm">
          <div className="absolute left-6 top-4 w-60 -rotate-6 rounded-3xl border border-black/5 bg-white p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full font-bold text-black" style={{ backgroundColor: TEAL }}>DC</div>
              <div>
                <div className="font-semibold">Dre Carter</div>
                <div className="text-xs text-black/50">★ 4.9 · Barber of the Month</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl px-3 py-2 text-sm font-medium" style={{ backgroundColor: `${GOLD}22`, color: '#9A6512' }}>
              🏆 Crowned in Chicago
            </div>
          </div>
          <div className="absolute right-2 top-28 w-56 rotate-3 rounded-3xl border border-black/5 bg-white p-4 shadow-xl">
            <div className="text-xs font-semibold text-black/40">NEW BOOKING</div>
            <div className="mt-1 font-semibold">Skin fade + beard</div>
            <div className="text-sm text-black/50">Sat · 3:00 PM</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: '#16A34A' }}>$20 deposit secured</span>
            </div>
          </div>
          <div className="absolute bottom-2 left-10 w-52 -rotate-3 rounded-3xl border border-black/5 bg-white p-4 shadow-xl">
            <div className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden>✨</span> StylePoints</div>
            <div className="mt-1 text-2xl font-bold">1,250</div>
            <div className="text-xs text-black/50">Gold tier · clients keep coming back</div>
          </div>
        </div>
      </section>

      {/* Product-truthful stat strip (no fabricated user counts) */}
      <section className="border-y border-black/5 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-5 py-10 sm:grid-cols-4">
          <Stat value="0" label="No-shows eat your day — deposits change that" />
          <Stat value="24/7" label="Clients book themselves, even while you sleep" />
          <Stat value="$0" label="To start — keep your current clients, add new ones" />
          <Stat value="🏆" label="Win your category in the Monthly Awards" />
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Everything to run — and grow — your chair</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-black/55">
          The day-to-day tools you'd expect, plus the discovery engine you won't find anywhere else.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Feature color={GOLD} emoji="📅" title="Online booking 24/7" body="Your calendar, bookable any time. Back-to-back slots are computed for you — no double-books." />
          <Feature color="#16A34A" emoji="🛡️" title="Deposits & no-show protection" body="Take a deposit at booking. Late cancel or no-show? You keep it. Your time is protected." />
          <Feature color={TEAL} emoji="💳" title="Get paid, your way" body="Secure payouts straight to your bank via Stripe. Deposits, memberships, and tips handled." />
          <Feature color={PINK} emoji="✨" title="StylePoints loyalty" body="Reward repeat clients automatically. Points and tiers keep them booking with you, not the shop next door." />
          <Feature color="#A78BFA" emoji="💎" title="Memberships & packages" body="Turn regulars into recurring revenue with your own membership tiers and member pricing." />
          <Feature color="#F4A93C" emoji="📣" title="Fill My Chair" body="A cancellation or slow afternoon? Blast a flash deal to your clients and fill the slot in minutes." />
        </div>
      </section>

      {/* Differentiator — the wedge */}
      <section className="bg-gradient-to-br from-[#1f1714] to-[#3a2a1e] py-16 text-white">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>What sets us apart</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Get discovered. Get crowned.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">
            Every month, clients and judges vote for the best in each category. Winners get featured, get
            booked, and get bragging rights. Then there's <strong className="text-white">The Lineup</strong> —
            a season-long bracket that turns local talent into local legends.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[['🏆', 'Monthly Awards', 'Win your category, get featured in discovery'], ['🎬', 'The Lineup', 'Compete on a live bracket — fans watch, you rise'], ['📍', 'Featured locally', 'Show up first when nearby clients search']].map(([e, t, b]) => (
              <div key={t} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left">
                <div className="text-2xl">{e}</div>
                <div className="mt-2 font-semibold">{t}</div>
                <div className="mt-1 text-sm text-white/60">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Offer / final CTA */}
      <section className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Start free. Grow from your first booking.</h2>
        {/* TODO(offer): confirm the real intro offer — e.g. "30 days free", "0% platform fee for 3 months". */}
        <p className="mx-auto mt-3 max-w-lg text-black/55">
          Set up your storefront in minutes, connect payouts, and take your first booking today.
        </p>
        <button onClick={onGetStarted} className="mt-7 rounded-full px-8 py-3.5 text-base font-semibold text-black shadow-md transition hover:brightness-95" style={{ backgroundColor: GOLD }}>
          Create your storefront
        </button>
        <p className="mt-3 text-sm text-black/45">
          Already with us? <button onClick={onSignIn} className="font-semibold underline" style={{ color: '#9A6512' }}>Sign in</button>
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-black/50 sm:flex-row">
          <div className="font-bold">Style<span style={{ color: GOLD }}>Profiles</span></div>
          <div className="flex gap-5">
            <button onClick={onGetStarted} className="hover:text-black/80">For pros</button>
            <button onClick={onGetStarted} className="hover:text-black/80">Book an appointment</button>
            <span>© {/* year set at render */}StyleProfiles</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
