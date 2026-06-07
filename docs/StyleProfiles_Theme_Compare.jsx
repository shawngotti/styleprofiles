import React from "react";
import { Search, Star, BadgeCheck, Crown, MapPin, Heart, Scissors, Sparkles, Gem, Eye, ChevronLeft, Clock } from "lucide-react";

/* StyleProfiles — Theme comparison (Dark current vs Light proposed)
   Same markup rendered under two palettes, on a neutral backdrop for a fair read. */

const CAT = [
  { key: "barber",  label: "Barber",    icon: Scissors, d: "#F4A93C", l: "#E8920F" },
  { key: "stylist", label: "Stylist",   icon: Sparkles, d: "#FF6FA5", l: "#FF4D8F" },
  { key: "nail",    label: "Nail Tech", icon: Gem,      d: "#F472D0", l: "#E84DBE" },
  { key: "lash",    label: "Lash Tech", icon: Eye,      d: "#56C2FF", l: "#1FA8E0" },
];
const catOf = (k) => CAT.find((c) => c.key === k) || CAT[0];

const THEMES = {
  dark: {
    mode: "dark", appBg: "#0B0B0E", surface: "#141418", surface2: "#1C1C22",
    text: "#F5F4F2", sub: "#9A9AA6", line: "rgba(255,255,255,0.08)", lineSoft: "rgba(255,255,255,0.05)",
    gold: "#E8C26B", goldGrad: "linear-gradient(135deg,#FCEBA6 0%,#E8C26B 45%,#C2902F 100%)",
    onGold: "#1A1306", cardShadow: "none", input: "#141418",
    appGlow: "radial-gradient(circle at 12% -5%, rgba(232,194,107,0.10), transparent 40%), radial-gradient(circle at 95% 8%, rgba(255,111,165,0.06), transparent 42%)",
    cat: (k) => catOf(k).d,
  },
  light: {
    mode: "light", appBg: "#F5F4F1", surface: "#FFFFFF", surface2: "#F1EFEA",
    text: "#1A1A1F", sub: "#6B6B73", line: "rgba(0,0,0,0.09)", lineSoft: "rgba(0,0,0,0.06)",
    gold: "#B8860B", goldGrad: "linear-gradient(135deg,#F7D88B 0%,#E0A22E 100%)",
    onGold: "#1A1306", cardShadow: "0 2px 10px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)", input: "#F1EFEA",
    appGlow: "radial-gradient(circle at 95% -5%, rgba(255,77,143,0.06), transparent 40%)",
    cat: (k) => catOf(k).l,
  },
};

const PROS = [
  { id: "p1", name: "Dre Carter", handle: "@dre.thebarber", cat: "barber", rating: 4.9, reviews: 312, city: "Chicago, IL", verified: true, from: 45, crown: true,
    bio: "Skin fades, beard sculpting, enhancements. 9 years behind the chair.", services: [["Signature Fade", 45], ["Fade + Beard", 65]] },
  { id: "p2", name: "Imani Brooks", handle: "@imani.silkpress", cat: "stylist", rating: 5.0, reviews: 198, city: "Atlanta, GA", verified: true, from: 80,
    bio: "Silk presses, healthy-hair styling, special-occasion looks.", services: [["Silk Press", 95], ["Wash & Style", 70]] },
  { id: "p3", name: "Priya Sharma", handle: "@priya.nails", cat: "nail", rating: 4.95, reviews: 503, city: "Jersey City, NJ", verified: true, from: 55, crown: true,
    bio: "Structured gel, hand-painted art, builder gel overlays.", services: [["Gel-X Full Set", 75], ["Builder Gel", 60]] },
  { id: "p4", name: "Sasha Lin", handle: "@lashedbysasha", cat: "lash", rating: 4.85, reviews: 244, city: "Brooklyn, NY", verified: true, from: 90,
    bio: "Volume & hybrid lash sets, lash lifts.", services: [["Hybrid Set", 130], ["Lash Lift", 90]] },
];

function Avatar({ name, color, size = 40, t, ring }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className="flex items-center justify-center font-bold shrink-0" style={{
      width: size, height: size, borderRadius: size, background: `linear-gradient(140deg, ${color}, ${color}66)`,
      color: "#fff", fontSize: size * 0.36, fontFamily: "'Hanken Grotesk',sans-serif",
      boxShadow: ring ? `0 0 0 2px ${t.surface}, 0 0 0 3.5px ${t.gold}` : "none",
    }}>{initials}</div>
  );
}
function Stars({ value, t, size = 13 }) {
  return <span className="inline-flex items-center" style={{ gap: 1 }}>
    {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={size} style={{ color: t.gold }} fill={i < Math.round(value) ? t.gold : "transparent"} strokeWidth={1.5} />)}
  </span>;
}
function CatBadge({ k, t, small }) {
  const c = t.cat(k); const Icon = catOf(k).icon;
  return <span className="inline-flex items-center font-semibold" style={{ gap: 5, padding: small ? "3px 9px" : "5px 11px", borderRadius: 999, fontSize: small ? 11 : 12, color: c, background: `${c}1A`, border: `1px solid ${c}40` }}>
    <Icon size={small ? 11 : 13} /> {catOf(k).label}</span>;
}
function Look({ k, t, h = 130, label }) {
  const c = t.cat(k); const Icon = catOf(k).icon;
  return <div className="relative overflow-hidden" style={{ height: h, borderRadius: 14, border: `1px solid ${t.line}` }}>
    <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${c}${t.mode === "dark" ? "38" : "55"}, ${t.surface2} 62%), radial-gradient(circle at 75% 20%, ${c}40, transparent 55%)` }} />
    <Icon size={Math.min(h * 0.42, 60)} strokeWidth={1} className="absolute" style={{ right: -6, bottom: -6, color: c, opacity: 0.28 }} />
    {label && <span className="absolute font-medium" style={{ left: 10, bottom: 8, fontSize: 12, color: t.mode === "dark" ? "#fff" : t.text }}>{label}</span>}
  </div>;
}
function Card({ children, style, t }) {
  return <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 18, boxShadow: t.cardShadow, ...style }}>{children}</div>;
}
function Chip({ label, color, icon: Icon, active, t }) {
  return <span className="inline-flex items-center font-semibold" style={{ gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 13,
    color: active ? (t.mode === "dark" ? "#0B0B0E" : "#fff") : t.text,
    background: active ? (color || t.gold) : (t.mode === "dark" ? "rgba(255,255,255,0.04)" : t.surface),
    border: `1px solid ${active ? (color || t.gold) : t.line}`, boxShadow: !active ? t.cardShadow : "none" }}>
    {Icon && <Icon size={14} />} {label}</span>;
}

function DiscoverMock({ t }) {
  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 600, margin: "0 0 4px", color: t.text }}>Discover pros</h2>
      <p style={{ color: t.sub, fontSize: 13, margin: "0 0 16px" }}>Find trusted talent, see real work, book in seconds.</p>
      <div className="flex items-center" style={{ gap: 10, padding: "11px 14px", borderRadius: 13, marginBottom: 14, background: t.input, border: `1px solid ${t.line}`, boxShadow: t.cardShadow }}>
        <Search size={17} style={{ color: t.sub }} />
        <span style={{ color: t.sub, fontSize: 14 }}>Search name, handle, or service…</span>
      </div>
      <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 18 }}>
        <Chip label="All" active t={t} />
        {CAT.map((c) => <Chip key={c.key} label={c.label} color={t.cat(c.key)} icon={c.icon} t={t} />)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {PROS.map((p) => (
          <Card key={p.id} t={t} style={{ overflow: "hidden" }}>
            <Look k={p.cat} t={t} h={104} />
            <div style={{ padding: 13 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: 9 }}>
                  <Avatar name={p.name} color={t.cat(p.cat)} size={34} t={t} />
                  <div>
                    <div className="flex items-center" style={{ gap: 4, fontWeight: 700, fontSize: 13.5, color: t.text }}>{p.name} {p.verified && <BadgeCheck size={13} style={{ color: t.gold }} />}</div>
                    <div style={{ color: t.sub, fontSize: 11.5 }}>{p.handle}</div>
                  </div>
                </div>
                {p.crown && <Crown size={16} style={{ color: t.gold }} />}
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 11 }}>
                <CatBadge k={p.cat} t={t} small />
                <span className="flex items-center" style={{ gap: 4, fontSize: 12 }}><Stars value={p.rating} t={t} size={11} /><b style={{ color: t.text }}>{p.rating}</b></span>
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${t.lineSoft}` }}>
                <span className="flex items-center" style={{ gap: 4, color: t.sub, fontSize: 11.5 }}><MapPin size={12} /> {p.city}</span>
                <span style={{ fontSize: 12, color: t.text }}>from <b style={{ color: t.gold }}>${p.from}</b></span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProfileMock({ t }) {
  const p = PROS[0]; const c = t.cat(p.cat);
  return (
    <div style={{ padding: 18 }}>
      <div className="flex items-center" style={{ gap: 6, color: t.sub, fontSize: 13, marginBottom: 12 }}><ChevronLeft size={15} /> Back</div>
      <div className="relative" style={{ height: 120, borderRadius: 18, overflow: "hidden", border: `1px solid ${t.line}` }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${c}${t.mode === "dark" ? "55" : "66"}, ${t.surface2}), radial-gradient(circle at 80% 10%, ${c}66, transparent 50%)` }} />
        <div className="absolute flex items-center" style={{ gap: 6, right: 12, top: 12, padding: "6px 11px", borderRadius: 999, background: t.mode === "dark" ? "rgba(11,11,14,0.6)" : "rgba(255,255,255,0.8)", border: `1px solid ${t.gold}66` }}>
          <Crown size={13} style={{ color: t.gold }} /><span style={{ fontSize: 12, fontWeight: 700, color: t.gold }}>Barber of the Month</span>
        </div>
      </div>
      <div className="flex items-end" style={{ gap: 13, marginTop: -28, padding: "0 4px" }}>
        <Avatar name={p.name} color={c} size={72} ring t={t} />
        <div style={{ paddingBottom: 4 }}>
          <div className="flex items-center" style={{ gap: 6, fontFamily: "'Fraunces',serif", fontSize: 23, fontWeight: 600, color: t.text }}>{p.name} {p.verified && <BadgeCheck size={18} style={{ color: t.gold }} />}</div>
          <div style={{ color: t.sub, fontSize: 13 }}>{p.handle}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 14, margin: "16px 4px 8px" }}>
        <CatBadge k={p.cat} t={t} />
        <span className="flex items-center" style={{ gap: 5, fontSize: 13, color: t.text }}><Stars value={p.rating} t={t} /> <b>{p.rating}</b> <span style={{ color: t.sub }}>({p.reviews})</span></span>
        <span className="flex items-center" style={{ gap: 5, color: t.sub, fontSize: 13 }}><MapPin size={14} /> {p.city}</span>
      </div>
      <p style={{ color: t.sub, fontSize: 13.5, lineHeight: 1.55, margin: "8px 4px 18px" }}>{p.bio}</p>
      <Card t={t} style={{ overflow: "hidden", marginBottom: 14 }}>
        {p.services.map((s, i) => (
          <div key={s[0]} className="flex items-center justify-between" style={{ padding: "13px 15px", borderTop: i ? `1px solid ${t.lineSoft}` : "none" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{s[0]}</div>
              <div className="flex items-center" style={{ gap: 5, color: t.sub, fontSize: 12, marginTop: 2 }}><Clock size={11} /> 45 min</div>
            </div>
            <div className="flex items-center" style={{ gap: 11 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>${s[1]}</span>
              <span className="font-semibold" style={{ padding: "7px 13px", borderRadius: 9, fontSize: 12.5, background: `${t.gold}1A`, color: t.gold, border: `1px solid ${t.gold}40` }}>Book</span>
            </div>
          </div>
        ))}
      </Card>
      <button className="font-bold inline-flex items-center justify-center" style={{ width: "100%", gap: 8, padding: "13px 0", borderRadius: 12, border: "none",
        background: t.goldGrad, color: t.onGold, fontSize: 14.5, boxShadow: t.mode === "dark" ? "0 8px 24px -10px rgba(232,194,107,0.7)" : "0 6px 18px -8px rgba(224,162,46,0.6)", cursor: "pointer" }}>Book now</button>
    </div>
  );
}

function Panel({ label, t, children }) {
  return (
    <div>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <span style={{ width: 11, height: 11, borderRadius: 11, background: t.appBg, border: "1px solid rgba(255,255,255,0.2)" }} />
        <span style={{ color: "#cfcfd6", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      </div>
      <div style={{ borderRadius: 22, overflow: "hidden", background: t.appBg, backgroundImage: t.appGlow, border: "1px solid rgba(255,255,255,0.07)" }}>
        {children}
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box}
.tc-root{font-family:'Hanken Grotesk',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
`;

export default function ThemeCompare() {
  const D = THEMES.dark, L = THEMES.light;
  return (
    <div className="tc-root" style={{ background: "#2a2a2e", borderRadius: 18, padding: "22px 20px 28px" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#E8C26B", fontWeight: 700 }}>THEME COMPARISON</div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 600, color: "#fff", margin: "6px 0 4px" }}>Dark vs. Light — same screens, side by side</h1>
          <p style={{ color: "#a9a9b2", fontSize: 13.5, lineHeight: 1.6, maxWidth: 680, margin: 0 }}>
            The light option keeps gold as the signature accent and lets the vibrant category colors do more as trims, on a clean white base with soft shadows for lift. Judge them on the same content below.
          </p>
        </div>

        {/* legend */}
        <div className="flex flex-wrap items-center" style={{ gap: 18, margin: "14px 0 24px" }}>
          {[["Dark base", "#0B0B0E"], ["Light base", "#F5F4F1"], ["Signature gold", "#E0A22E"], ["Stylist", "#FF4D8F"], ["Lash", "#1FA8E0"], ["Nail", "#E84DBE"]].map(([n, col]) => (
            <span key={n} className="flex items-center" style={{ gap: 7, color: "#cfcfd6", fontSize: 12 }}>
              <span style={{ width: 16, height: 16, borderRadius: 5, background: col, border: "1px solid rgba(255,255,255,0.15)" }} /> {n}
            </span>
          ))}
        </div>

        {/* Row 1 — Discover */}
        <div style={{ color: "#8a8a92", fontSize: 12, fontWeight: 700, letterSpacing: 1, margin: "0 0 12px" }}>SCREEN 1 · DISCOVER</div>
        <div className="tc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 22, marginBottom: 34 }}>
          <Panel label="DARK — current" t={D}><DiscoverMock t={D} /></Panel>
          <Panel label="LIGHT — proposed" t={L}><DiscoverMock t={L} /></Panel>
        </div>

        {/* Row 2 — Profile */}
        <div style={{ color: "#8a8a92", fontSize: 12, fontWeight: 700, letterSpacing: 1, margin: "0 0 12px" }}>SCREEN 2 · PRO PROFILE</div>
        <div className="tc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 22 }}>
          <Panel label="DARK — current" t={D}><ProfileMock t={D} /></Panel>
          <Panel label="LIGHT — proposed" t={L}><ProfileMock t={L} /></Panel>
        </div>
      </div>
    </div>
  );
}
