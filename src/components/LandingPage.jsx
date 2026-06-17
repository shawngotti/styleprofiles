// Bright, image-forward marketing landing page (Booksy-style): pure white,
// modern, photo-rich. Public front door for logged-out visitors; CTAs hand off
// to the auth screen. Stock photos are Unsplash (free license) for the prototype
// — swap for owned/properly-licensed assets before a wide launch.
const GOLD = '#F4A93C'
const PINK = '#FF6FA5'
const INK = '#15110e'

// Unsplash CDN helper (auto-format + crop + width for perf).
const img = (id, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`
const HERO = img('1585747860715-2ba37e788b70', 1100)
const FEATURE = img('1580618672591-eb180b1a973f', 1000)
const TESTIMONIAL = img('1599351431202-1e0f0137899a', 400)
const SPECIALTIES = [
  ['Barbers', '1503951914875-452162b0f3f1', '#F4A93C'],
  ['Stylists', '1562322140-8baeececf3df', '#FF6FA5'],
  ['Nail techs', '1633681926022-84c23e8cb2d6', '#F472D0'],
  ['Makeup', '1487412947147-5cebf100ffc2', '#FF8A5B'],
  ['Lash & brow', '1599351431202-1e0f0137899a', '#56C2FF'],
]

function Feature({ color, emoji, title, body }) {
  return (
    <div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: `${color}1f` }}>
        <span aria-hidden>{emoji}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold" style={{ color: INK }}>{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-black/55">{body}</p>
    </div>
  )
}

export default function LandingPage({ onGetStarted, onSignIn }) {
  return (
    <div className="min-h-screen bg-white" style={{ color: INK }}>
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="text-xl font-extrabold tracking-tight">Style<span style={{ color: GOLD }}>Profiles</span></div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={onSignIn} className="rounded-full px-4 py-2 font-medium text-black/70 hover:bg-black/[0.04]">Sign in</button>
            <button onClick={onGetStarted} className="rounded-full px-4 py-2 font-semibold text-black shadow-sm" style={{ backgroundColor: GOLD }}>Start free</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:py-16 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${PINK}17`, color: '#C13B73' }}>
            ✦ For barbers, stylists, nail &amp; lash artists
          </span>
          <h1 className="mt-4 text-[2.6rem] font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
            Get booked.<br />Get paid.<br /><span style={{ color: GOLD }}>Get famous.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-black/55">
            The booking app that also grows your name — appointments with deposits, loyalty that brings
            clients back, and monthly awards that put you on the map.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button onClick={onGetStarted} className="rounded-full px-7 py-3.5 text-base font-semibold text-black shadow-md transition hover:brightness-95" style={{ backgroundColor: GOLD }}>
              Start free now
            </button>
            {/* Offer mirrors Booksy's prototype offers — set your real terms/price before launch. */}
            <span className="text-sm text-black/45">14-day free trial · no credit card required</span>
          </div>
        </div>

        {/* Hero image with floating proof cards */}
        <div className="relative">
          <div className="overflow-hidden rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <img src={HERO} alt="A barber giving a client a fresh fade" className="aspect-[4/5] w-full object-cover sm:aspect-[5/5]" />
          </div>
          <div className="absolute -left-3 top-8 rounded-2xl border border-black/5 bg-white/95 px-4 py-3 shadow-xl backdrop-blur sm:-left-6">
            <div className="text-[10px] font-bold uppercase tracking-wide text-black/40">New booking</div>
            <div className="mt-0.5 text-sm font-semibold">Skin fade + beard</div>
            <div className="text-xs font-semibold" style={{ color: '#16A34A' }}>$20 deposit secured ✓</div>
          </div>
          <div className="absolute -right-2 bottom-8 flex items-center gap-2 rounded-2xl border border-black/5 bg-white/95 px-4 py-3 shadow-xl backdrop-blur sm:-right-5">
            <span className="text-xl">🏆</span>
            <div>
              <div className="text-sm font-semibold">Barber of the Month</div>
              <div className="text-xs text-black/45">★ 4.9 · featured in Chicago</div>
            </div>
          </div>
        </div>
      </section>

      {/* Specialties strip */}
      <section className="mx-auto max-w-6xl px-5 pb-4 pt-6">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-black/35">Built for every chair</p>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {SPECIALTIES.map(([label, id, color]) => (
            <div key={label} className="group text-center">
              <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
                <img src={img(id, 400)} alt={label} loading="lazy" className="aspect-square w-full object-cover transition group-hover:scale-105" />
              </div>
              <div className="mt-2 text-sm font-semibold" style={{ color }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature: image + points */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2">
        <div className="order-2 overflow-hidden rounded-[2rem] shadow-[0_16px_50px_rgba(0,0,0,0.12)] lg:order-1">
          <img src={FEATURE} alt="Stylist working with a client in a bright salon" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </div>
        <div className="order-1 lg:order-2">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Run your whole day from your pocket</h2>
          <p className="mt-3 text-black/55">The day-to-day tools you'd expect — built to be fast and stay out of your way.</p>
          <ul className="mt-6 space-y-4">
            {[
              ['📅', 'Online booking 24/7', 'Clients book themselves; back-to-back slots are computed for you.'],
              ['🛡️', 'Deposits & no-show protection', 'Take a deposit at booking. No-show? You keep it — your time is protected.'],
              ['💳', 'Get paid to your bank', 'Secure payouts via Stripe — deposits, memberships, and tips handled.'],
            ].map(([e, t, b]) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: '#F5F5F7' }}>{e}</span>
                <div>
                  <div className="font-semibold">{t}</div>
                  <div className="text-sm text-black/55">{b}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Feature color={PINK} emoji="✨" title="StylePoints loyalty" body="Reward repeat clients automatically — points and tiers keep them booking with you." />
          <Feature color="#A78BFA" emoji="💎" title="Memberships & packages" body="Turn regulars into recurring revenue with your own tiers and member pricing." />
          <Feature color={GOLD} emoji="📣" title="Fill My Chair" body="Cancellation or slow afternoon? Blast a flash deal and fill the slot in minutes." />
        </div>
      </section>

      {/* Differentiator band */}
      <section className="px-5 py-4">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1f1714] via-[#2a1d16] to-[#3a2a1e] px-6 py-14 text-white sm:px-12">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>What sets us apart</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Get discovered. Get crowned.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/65">
              Each month, clients and judges vote for the best in every category — winners get featured and
              booked. Then there's <strong className="text-white">The Lineup</strong>: a season-long bracket
              that turns local talent into local legends.
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {[['🏆', 'Monthly Awards', 'Win your category, get featured in discovery'], ['🎬', 'The Lineup', 'Compete on a live bracket — fans watch, you rise'], ['📍', 'Featured locally', 'Show up first when nearby clients search']].map(([e, t, b]) => (
              <div key={t} className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <div className="text-2xl">{e}</div>
                <div className="mt-2 font-semibold">{t}</div>
                <div className="mt-1 text-sm text-white/60">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <img src={TESTIMONIAL} alt="A StyleProfiles professional" loading="lazy" className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-black/5" />
        {/* TODO(testimonial): replace with a real pro quote + name */}
        <p className="mt-5 text-2xl font-semibold leading-snug">
          "I went from texting to confirm every cut to a full book with deposits — and winning Barber of the Month brought me a wave of new clients."
        </p>
        <p className="mt-4 text-sm font-medium text-black/50">— A StyleProfiles pro · Chicago</p>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-4xl rounded-[2.5rem] border border-black/[0.06] bg-[#F7F7F8] px-6 py-14 text-center sm:px-12">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Try StyleProfiles free for 14 days</h2>
          <p className="mx-auto mt-3 max-w-lg text-black/55">
            No credit card to start. Set up your storefront, connect payouts, and take your first booking — then
            just $29.99/mo.
          </p>
          <button onClick={onGetStarted} className="mt-7 rounded-full px-8 py-3.5 text-base font-semibold text-black shadow-md transition hover:brightness-95" style={{ backgroundColor: GOLD }}>
            Start free now
          </button>
          {/* Offer numbers mirror Booksy — confirm your real price/promo before launch. */}
          <p className="mt-4 text-sm text-black/55">
            Use code <strong style={{ color: INK }}>TRY50</strong> for 50% off your first month · cancel anytime
          </p>
          <p className="mt-2 text-sm text-black/45">
            Already with us? <button onClick={onSignIn} className="font-semibold underline" style={{ color: '#9A6512' }}>Sign in</button>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-black/45 sm:flex-row">
          <div className="font-bold text-black/70">Style<span style={{ color: GOLD }}>Profiles</span></div>
          <div className="flex flex-wrap items-center gap-5">
            <button onClick={onGetStarted} className="hover:text-black/80">For pros</button>
            <button onClick={onGetStarted} className="hover:text-black/80">Book an appointment</button>
            <a href="/legal/terms.html" target="_blank" rel="noreferrer" className="hover:text-black/80">Terms</a>
            <a href="/legal/privacy.html" target="_blank" rel="noreferrer" className="hover:text-black/80">Privacy</a>
            <span>© StyleProfiles</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
