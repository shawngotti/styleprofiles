import React, { useState, useMemo, useEffect } from "react";
import {
  Scissors, Sparkles, Waves, Flower2, Gem, Eye, Paintbrush, Droplet,
  TrendingUp, Store, Crown, Star, Award, Trophy, BadgeCheck, Calendar,
  Clock, Heart, Search, MapPin, Bell, Check, ChevronRight, ChevronLeft,
  ArrowRight, X, Plus, DollarSign, Users, Repeat, Gift, Image as ImageIcon,
  Megaphone, Zap, Shield, ShieldCheck, Flag, AlertTriangle, Trash2, Tag,
  MessageSquare, Send, Lock, EyeOff, Globe, Ban, Inbox, CheckCircle2, Settings, Mail,
  ShoppingBag, Package, Power, Minus, Swords
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

/* ----------------------------------------------------------------------------
   StyleProfiles — clickable prototype (v2)
   Book the look. Build the profile. Get crowned.
   All data, payments, auth, voting and moderation are simulated client-side.
---------------------------------------------------------------------------- */

const C = {
  bg: "#0B0B0E", surface: "#141418", surface2: "#1C1C22",
  line: "rgba(255,255,255,0.08)", lineSoft: "rgba(255,255,255,0.05)",
  text: "#F5F4F2", sub: "#9A9AA6", gold: "#E8C26B",
  goldGrad: "linear-gradient(135deg,#FCEBA6 0%,#E8C26B 45%,#C2902F 100%)",
};

const CATS = [
  { key: "barber",    label: "Barber",    icon: Scissors,   color: "#F4A93C" },
  { key: "stylist",   label: "Stylist",   icon: Sparkles,   color: "#FF6FA5" },
  { key: "braider",   label: "Braider",   icon: Waves,      color: "#A78BFA" },
  { key: "loctician", label: "Loctician", icon: Flower2,    color: "#2DD4BF" },
  { key: "nail",      label: "Nail Tech", icon: Gem,        color: "#F472D0" },
  { key: "lash",      label: "Lash Tech", icon: Eye,        color: "#56C2FF" },
  { key: "makeup",    label: "Makeup",    icon: Paintbrush, color: "#FF8A5B" },
  { key: "colorist",  label: "Colorist",  icon: Droplet,    color: "#34D399" },
];
const catOf = (k) => CATS.find((c) => c.key === k) || CATS[0];

const PROS = [
  { id: "p1", name: "Dre Carter", handle: "@dre.thebarber", cat: "barber", rating: 4.9, reviews: 312, city: "Chicago, IL", verified: true, from: 45, crown: "Barber of the Month",
    bio: "Skin fades, beard sculpting, enhancements. 9 years behind the chair. Walk-ins by request.",
    services: [ { name: "Signature Fade", min: 45, price: 45, dep: 15 }, { name: "Fade + Beard", min: 60, price: 65, dep: 20 }, { name: "Kids Cut (12 & under)", min: 30, price: 30, dep: 10 }, { name: "Line-Up / Edge", min: 20, price: 20, dep: 5 } ],
    looks: ["Fresh fade", "Beard sculpt", "Design line", "Taper"] },
  { id: "p2", name: "Imani Brooks", handle: "@imani.silkpress", cat: "stylist", rating: 5.0, reviews: 198, city: "Atlanta, GA", verified: true, from: 80,
    bio: "Silk presses, healthy-hair styling, special-occasion looks. Consultations included.",
    services: [ { name: "Silk Press", min: 90, price: 95, dep: 30 }, { name: "Wash & Style", min: 60, price: 70, dep: 20 }, { name: "Bridal / Event", min: 120, price: 180, dep: 60 } ],
    looks: ["Silk press", "Glam wave", "Updo", "Sleek"] },
  { id: "p3", name: "Nia Osei", handle: "@knotbynia", cat: "braider", rating: 4.8, reviews: 421, city: "Houston, TX", verified: true, from: 120, crown: "Braider of the Month",
    bio: "Knotless braids, boho, feed-ins, kids styles. Hair included on most styles.",
    services: [ { name: "Knotless — Medium", min: 240, price: 180, dep: 60 }, { name: "Boho Knotless", min: 300, price: 230, dep: 70 }, { name: "Feed-in Cornrows", min: 120, price: 90, dep: 30 } ],
    looks: ["Knotless", "Boho", "Feed-in", "Bun"] },
  { id: "p4", name: "Marcus Vale", handle: "@valeloc", cat: "loctician", rating: 4.9, reviews: 156, city: "Newark, NJ", verified: true, from: 70,
    bio: "Starter locs, retwists, loc repair and styling. Healthy scalp first.",
    services: [ { name: "Retwist + Style", min: 90, price: 85, dep: 25 }, { name: "Starter Locs", min: 150, price: 140, dep: 40 }, { name: "Loc Detox", min: 75, price: 75, dep: 20 } ],
    looks: ["Retwist", "Barrel", "Starter", "Updo"] },
  { id: "p5", name: "Priya Sharma", handle: "@priya.nails", cat: "nail", rating: 4.95, reviews: 503, city: "Jersey City, NJ", verified: true, from: 55, crown: "Nail Tech of the Month",
    bio: "Structured gel, hand-painted art, builder gel overlays. Designs welcome.",
    services: [ { name: "Gel-X Full Set", min: 90, price: 75, dep: 20 }, { name: "Builder Gel Overlay", min: 60, price: 60, dep: 15 }, { name: "Custom Nail Art (set)", min: 120, price: 110, dep: 35 } ],
    looks: ["Chrome", "French", "Hand-paint", "Almond"] },
  { id: "p6", name: "Sasha Lin", handle: "@lashedbysasha", cat: "lash", rating: 4.85, reviews: 244, city: "Brooklyn, NY", verified: true, from: 90,
    bio: "Volume & hybrid lash sets, lash lifts. Retention-focused application.",
    services: [ { name: "Hybrid Full Set", min: 120, price: 130, dep: 40 }, { name: "Mega Volume", min: 150, price: 165, dep: 50 }, { name: "Lash Lift + Tint", min: 75, price: 90, dep: 25 } ],
    looks: ["Hybrid", "Volume", "Cat-eye", "Lift"] },
  { id: "p7", name: "Bel Aguilar", handle: "@belbeatface", cat: "makeup", rating: 4.9, reviews: 187, city: "Miami, FL", verified: true, from: 110,
    bio: "Soft glam, editorial, bridal. Skin-first, long-wear application.",
    services: [ { name: "Soft Glam", min: 75, price: 110, dep: 35 }, { name: "Full Glam + Lashes", min: 90, price: 140, dep: 45 }, { name: "Bridal Trial", min: 120, price: 180, dep: 60 } ],
    looks: ["Soft glam", "Editorial", "Bronze", "Bridal"] },
  { id: "p8", name: "Theo Banks", handle: "@theocolor", cat: "colorist", rating: 4.8, reviews: 132, city: "Philadelphia, PA", verified: true, from: 150,
    bio: "Balayage, vivids, color correction. Bond-building on every service.",
    services: [ { name: "Balayage + Gloss", min: 180, price: 200, dep: 70 }, { name: "Root Touch-Up", min: 90, price: 95, dep: 30 }, { name: "Vivid / Fashion Color", min: 240, price: 260, dep: 90 } ],
    looks: ["Balayage", "Vivid", "Gloss", "Money piece"] },
];
const proById = (id) => PROS.find((p) => p.id === id);
const first = (n) => n.split(" ")[0];

// Membership tiers per pro (seed; the Pro-facing editor comes in Batch 3)
const MEMBERSHIPS = {
  p1: [{ id: "p1c", name: "The Chair Club", price: 99, includes: "2 cuts / month", perks: ["15% off add-ons", "Priority booking", "Free line-ups"] }],
  p3: [{ id: "p3c", name: "Crown Club", price: 180, includes: "1 install / month", perks: ["Free takedown", "10% off boho styles", "Priority dates"] }],
  p5: [{ id: "p5c", name: "Nail Society", price: 120, includes: "2 fills / month", perks: ["Free nail art", "15% off full sets", "Birthday set on us"] }],
  p2: [{ id: "p2c", name: "Silk Circle", price: 150, includes: "2 styles / month", perks: ["Free deep condition", "Priority weekends"] }],
};
const membershipFor = (proId) => (MEMBERSHIPS[proId] || [])[0] || null;

// "Frequently added" add-on services by category
const ADDONS = {
  barber:    [{ name: "Beard oil finish", min: 5, price: 12, dep: 0, addon: true }, { name: "Hot towel", min: 5, price: 8, dep: 0, addon: true }, { name: "Hairline design", min: 10, price: 15, dep: 5, addon: true }],
  stylist:   [{ name: "Deep condition", min: 15, price: 25, dep: 0, addon: true }, { name: "Ends trim", min: 10, price: 15, dep: 0, addon: true }],
  braider:   [{ name: "Scalp treatment", min: 10, price: 20, dep: 0, addon: true }, { name: "Beads & cuffs", min: 10, price: 15, dep: 0, addon: true }],
  loctician: [{ name: "Scalp detox", min: 15, price: 20, dep: 0, addon: true }, { name: "Loc jewelry", min: 5, price: 12, dep: 0, addon: true }],
  nail:      [{ name: "Chrome finish", min: 10, price: 12, dep: 0, addon: true }, { name: "Nail art (2)", min: 10, price: 15, dep: 5, addon: true }],
  lash:      [{ name: "Lash bath", min: 10, price: 15, dep: 0, addon: true }, { name: "Bottom lashes", min: 15, price: 25, dep: 0, addon: true }],
  makeup:    [{ name: "Strip lashes", min: 5, price: 15, dep: 0, addon: true }, { name: "Touch-up kit", min: 0, price: 20, dep: 0, addon: true }],
  colorist:  [{ name: "Bond treatment", min: 15, price: 30, dep: 0, addon: true }, { name: "Gloss top-off", min: 20, price: 35, dep: 0, addon: true }],
};
const addonsFor = (cat) => ADDONS[cat] || [];

// First-party self-care marketplace catalog (dark until admin enables it)
const PROD_CATS = [
  { key: "hair",  label: "Hair",         color: "#FF6FA5" },
  { key: "beard", label: "Beard & Shave", color: "#F4A93C" },
  { key: "skin",  label: "Skin",         color: "#34D399" },
  { key: "nails", label: "Nails",        color: "#F472D0" },
  { key: "tools", label: "Tools",        color: "#56C2FF" },
];
const prodCatOf = (k) => PROD_CATS.find((c) => c.key === k) || PROD_CATS[0];
const PRODUCTS = [
  { id: "pr1", name: "Edge & Hairline Pomade", brand: "Crown & Co.", cat: "hair", price: 18, blurb: "Strong hold, no flaking. Sleek finish.", usedBy: "p1" },
  { id: "pr2", name: "Beard Oil — Amber", brand: "Crown & Co.", cat: "beard", price: 22, blurb: "Softens & conditions. Cedar + amber.", usedBy: "p1" },
  { id: "pr3", name: "Silk Press Heat Shield", brand: "Glasshouse", cat: "hair", price: 26, blurb: "Thermal protection up to 450°F.", usedBy: "p2" },
  { id: "pr4", name: "Scalp Renew Serum", brand: "Rooted", cat: "hair", price: 32, blurb: "Lightweight scalp & follicle treatment.", usedBy: "p4" },
  { id: "pr5", name: "Cuticle Recovery Oil", brand: "Lacquer Lab", cat: "nails", price: 14, blurb: "Jojoba + vitamin E pen applicator.", usedBy: "p5" },
  { id: "pr6", name: "Daily Glow Moisturizer", brand: "Aura", cat: "skin", price: 28, blurb: "Niacinamide hydration with SPF 30." },
  { id: "pr7", name: "Lash Cleanser Foam", brand: "Aura", cat: "skin", price: 16, blurb: "Gentle daily cleanse for lash retention.", usedBy: "p6" },
  { id: "pr8", name: "Pro Detailing Trimmer", brand: "Forge", cat: "tools", price: 79, blurb: "Cordless T-blade. 2-hour runtime." },
  { id: "pr9", name: "Bond Repair Mask", brand: "Glasshouse", cat: "hair", price: 34, blurb: "Weekly reconstructive treatment.", usedBy: "p8" },
  { id: "pr10", name: "Satin-Lined Bonnet", brand: "Crown & Co.", cat: "hair", price: 24, blurb: "Protects styles overnight. Adjustable." },
];
const productById = (id) => PRODUCTS.find((p) => p.id === id);

const SEED_VOTES = { barber: { p1: 1284 }, braider: { p3: 982 }, nail: { p5: 1510 }, stylist: { p2: 740 } };

const SEED_REVIEWS = {
  p1: [
    { who: "Jordan P.", rating: 5, when: "2 weeks ago", text: "Cleanest fade in the city. In and out, lined up perfect.", tags: ["On time", "Clean space"], reply: "Appreciate you — see you next month." },
    { who: "Andre M.", rating: 5, when: "1 month ago", text: "Took his time on the beard blend. Worth every dollar.", tags: ["Great detail"], reply: null },
    { who: "Tre W.", rating: 4, when: "1 month ago", text: "Solid cut, ran a few minutes behind but worth the wait.", tags: [], reply: "Thanks for the patience — schedule's tighter now." },
  ],
  p5: [
    { who: "Dani R.", rating: 5, when: "5 days ago", text: "The chrome set lasted 3 weeks with zero lifting. Obsessed.", tags: ["Lasts long", "Clean space"], reply: "Yay! Thank you Dani 🤍" },
    { who: "Mel C.", rating: 5, when: "3 weeks ago", text: "Brought a Pinterest pic and she nailed it exactly.", tags: ["Great detail"], reply: null },
  ],
};
const REVIEW_TAGS = ["On time", "Clean space", "Great detail", "Lasts long", "Great with kids", "Friendly"];

const SEED_TAGS = [
  { id: "t1", proId: "p2", look: "Silk press", forContest: true, status: "pending" },
  { id: "t2", proId: "p5", look: "Chrome set", forContest: false, status: "pending" },
  { id: "t3", proId: "p7", look: "Soft glam", forContest: true, status: "pending" },
];

const SEED_SUBS = [
  { id: "s1", proId: "p1", cat: "barber", look: "Fresh fade", status: "pending" },
  { id: "s2", proId: "p3", cat: "braider", look: "Boho knotless", status: "pending" },
  { id: "s3", proId: "p7", cat: "makeup", look: "Soft glam", status: "flagged", flag: "Reverse-image match found elsewhere" },
  { id: "s4", proId: "p5", cat: "nail", look: "Chrome set", status: "pending" },
  { id: "s5", proId: "p6", cat: "lash", look: "Mega volume", status: "pending" },
];
const SEED_REPORTS = [
  { id: "r1", kind: "Portfolio post", who: "@belbeatface", reason: "Image may not be original work", sev: "High" },
  { id: "r2", kind: "Review", who: "@dre.thebarber", reason: "Suspected fake / incentivized review", sev: "Med" },
  { id: "r3", kind: "Profile bio", who: "@knotbynia", reason: "Off-platform booking contact in bio", sev: "Low" },
];
const SEED_FLAGVOTES = [
  { id: "fv1", cat: "nail", proId: "p5", note: "212 votes from one device in 4 minutes", count: 212 },
  { id: "fv2", cat: "barber", proId: "p1", note: "Vote burst from newly-created accounts", count: 64 },
];

/* ------------------------------- atoms ----------------------------------- */
function Avatar({ name, color, size = 44, ring }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className="flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, borderRadius: size, background: `linear-gradient(140deg, ${color}, ${color}55)`,
        color: "#0B0B0E", fontSize: size * 0.36, fontFamily: "'Hanken Grotesk',sans-serif",
        boxShadow: ring ? `0 0 0 2px ${C.bg}, 0 0 0 3.5px ${C.gold}` : "none" }}>
      {initials}
    </div>
  );
}
function Stars({ value, size = 13, onPick }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} style={{ color: C.gold, cursor: onPick ? "pointer" : "default" }}
          onClick={onPick ? () => onPick(i + 1) : undefined}
          fill={i < Math.round(value) ? C.gold : "transparent"} strokeWidth={1.5} />
      ))}
    </span>
  );
}
function CatBadge({ k, small }) {
  const c = catOf(k); const Icon = c.icon;
  return (
    <span className="inline-flex items-center font-semibold"
      style={{ gap: 5, padding: small ? "3px 9px" : "5px 11px", borderRadius: 999, fontSize: small ? 11 : 12,
        color: c.color, background: `${c.color}1A`, border: `1px solid ${c.color}40` }}>
      <Icon size={small ? 11 : 13} /> {c.label}
    </span>
  );
}
function Look({ k, label, h = 150, beforeAfter }) {
  const c = catOf(k); const Icon = c.icon;
  return (
    <div className="relative overflow-hidden" style={{ height: h, borderRadius: 16, border: `1px solid ${C.line}` }}>
      <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${c.color}38, ${C.surface2} 60%), radial-gradient(circle at 75% 20%, ${c.color}33, transparent 55%)` }} />
      <Icon size={Math.min(h * 0.42, 64)} strokeWidth={1} className="absolute" style={{ right: -6, bottom: -6, color: c.color, opacity: 0.22 }} />
      {beforeAfter && (<>
        <div className="absolute" style={{ top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(255,255,255,0.25)" }} />
        <span className="absolute font-semibold" style={{ left: 8, top: 8, fontSize: 9, letterSpacing: 1, color: "#fff", opacity: 0.75 }}>BEFORE</span>
        <span className="absolute font-semibold" style={{ right: 8, top: 8, fontSize: 9, letterSpacing: 1, color: "#fff", opacity: 0.85 }}>AFTER</span>
      </>)}
      {label && <span className="absolute font-medium" style={{ left: 10, bottom: 8, fontSize: 12, color: C.text }}>{label}</span>}
    </div>
  );
}
function Card({ children, style, className = "", onClick }) {
  return <div onClick={onClick} className={className} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, ...style }}>{children}</div>;
}
function GoldButton({ children, onClick, full, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} className="font-bold inline-flex items-center justify-center transition"
      style={{ gap: 8, padding: "12px 20px", borderRadius: 12, border: "none", width: full ? "100%" : "auto",
        cursor: disabled ? "not-allowed" : "pointer", background: disabled ? "rgba(255,255,255,0.08)" : C.goldGrad,
        color: disabled ? C.sub : "#1A1306", fontSize: 14.5, boxShadow: disabled ? "none" : "0 8px 24px -10px rgba(232,194,107,0.7)", ...style }}>
      {children}
    </button>
  );
}
function GhostButton({ children, onClick, full, style }) {
  return (
    <button onClick={onClick} className="font-semibold inline-flex items-center justify-center"
      style={{ gap: 7, padding: "11px 18px", borderRadius: 12, fontSize: 14, width: full ? "100%" : "auto", cursor: "pointer",
        background: "rgba(255,255,255,0.04)", color: C.text, border: `1px solid ${C.line}`, ...style }}>
      {children}
    </button>
  );
}
function Chip({ label, color = C.gold, icon: Icon, active, onClick }) {
  return (
    <button onClick={onClick} className="font-semibold inline-flex items-center transition"
      style={{ gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
        color: active ? "#0B0B0E" : C.text, background: active ? color : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? color : C.line}` }}>
      {Icon && <Icon size={14} />} {label}
    </button>
  );
}
function SectionTitle({ icon: Icon, children, top = 0 }) {
  return (
    <div className="flex items-center" style={{ gap: 8, marginBottom: 12, marginTop: top }}>
      {Icon && <Icon size={16} style={{ color: C.gold }} />}
      <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.2 }}>{children}</span>
    </div>
  );
}
function H2({ children }) {
  return <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 600, margin: "0 0 4px" }}>{children}</h2>;
}
function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", color: C.sub, fontSize: 12.5, marginBottom: 6 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: C.surface2, color: C.text,
          border: `1px solid ${C.line}`, fontSize: 14, fontFamily: "'Hanken Grotesk',sans-serif", outline: "none" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

/* ------------------------------ landing ----------------------------------- */
function Landing({ go, setView }) {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 22px" }}>
      <div className="relative" style={{ padding: "56px 0 36px" }}>
        <span style={{ fontSize: 12, letterSpacing: 2, color: C.gold, fontWeight: 700 }}>MONTHLY AWARDS · BOOKING · LOYALTY · PORTFOLIO</span>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, lineHeight: 0.98, fontSize: "clamp(40px,6.6vw,76px)", color: C.text, letterSpacing: "-0.02em", margin: "22px 0 0" }}>
          Book the look.<br />Build the profile.<br />
          <span style={{ fontStyle: "italic", background: C.goldGrad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Get crowned.</span>
        </h1>
        <p style={{ color: C.sub, fontSize: 17, lineHeight: 1.6, maxWidth: 540, marginTop: 22 }}>
          The booking platform built for beauty &amp; grooming pros — appointments, deposits, StylePoints loyalty, visual portfolios, and monthly category awards, all in one place.
        </p>
        <div className="flex flex-wrap" style={{ gap: 12, marginTop: 30 }}>
          <GoldButton onClick={() => { setView("client"); go("discover"); }}>Explore as a client <ArrowRight size={17} /></GoldButton>
          <GhostButton onClick={() => { setView("pro"); go("dashboard"); }}>I'm a beauty pro <ChevronRight size={16} /></GhostButton>
          <GhostButton onClick={() => { setView("admin"); go("admin"); }}><Shield size={15} /> Admin console</GhostButton>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        {[ { icon: Calendar, t: "Get booked", d: "Calendar, deposits, no-show protection, and one-tap rebooking." },
           { icon: Crown, t: "Get crowned", d: "Monthly awards by category — clients vote, winners get featured." },
           { icon: Gift, t: "Build loyalty", d: "Custom StylePoints rules turn first visits into regulars." } ].map((p) => {
          const Icon = p.icon;
          return (
            <Card key={p.t} style={{ padding: 20 }}>
              <div className="flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, marginBottom: 14, background: `${C.gold}1A`, border: `1px solid ${C.gold}40` }}><Icon size={20} style={{ color: C.gold }} /></div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{p.t}</div>
              <div style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.55 }}>{p.d}</div>
            </Card>
          );
        })}
      </div>
      <Card style={{ marginTop: 28, padding: 22, overflow: "hidden", position: "relative" }}>
        <div className="absolute" style={{ inset: 0, background: `radial-gradient(circle at 90% 0%, ${C.gold}22, transparent 55%)` }} />
        <div className="relative flex items-center justify-between flex-wrap" style={{ gap: 16 }}>
          <div>
            <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}><Trophy size={18} style={{ color: C.gold }} /><span style={{ fontWeight: 700, fontSize: 17 }}>This Month's Awards are live</span></div>
            <div style={{ color: C.sub, fontSize: 14 }}>Voting closes in 6 days · {CATS.length} categories · 14,200+ votes cast</div>
          </div>
          <GhostButton onClick={() => { setView("client"); go("awards"); }}>Go vote <ChevronRight size={16} /></GhostButton>
        </div>
      </Card>
      <div style={{ height: 40 }} />
    </div>
  );
}

/* ------------------------------ discover ---------------------------------- */
const SIM_MILES = { p1: 2.4, p2: 31, p3: 18.2, p4: 5.1, p5: 3.8, p6: 12.2, p7: 44, p8: 9.6 };

function Discover({ openPro }) {
  const [q, setQ] = useState(""); const [active, setActive] = useState("all");
  const [geo, setGeo] = useState(false); const [radius, setRadius] = useState("Any"); const [sort, setSort] = useState("Recommended");
  const radiusMi = { "Any": Infinity, "5 mi": 5, "10 mi": 10, "25 mi": 25, "50 mi": 50 };
  const miles = (p) => SIM_MILES[p.id] != null ? SIM_MILES[p.id] : 15;
  const list = useMemo(() => {
    let r = PROS.filter((p) => {
      const okCat = active === "all" || p.cat === active;
      const okQ = !q || (p.name + p.handle + catOf(p.cat).label).toLowerCase().includes(q.toLowerCase());
      const okDist = !geo || miles(p) <= radiusMi[radius];
      return okCat && okQ && okDist;
    });
    if (geo && sort === "Nearest") r = [...r].sort((a, b) => miles(a) - miles(b));
    return r;
  }, [q, active, geo, radius, sort]);
  const selStyle = { padding: "8px 12px", borderRadius: 999, background: C.surface, color: C.text, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'Hanken Grotesk',sans-serif", outline: "none", cursor: "pointer" };
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 22px 48px" }}>
      <H2>Discover pros</H2>
      <p style={{ color: C.sub, fontSize: 14, margin: "0 0 18px" }}>Find trusted talent, see real work, book in seconds.</p>
      <div className="flex items-center" style={{ gap: 10, padding: "12px 16px", borderRadius: 14, marginBottom: 12, background: C.surface, border: `1px solid ${C.line}` }}>
        <Search size={18} style={{ color: C.sub }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, handle, or service…"
          style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 15, width: "100%", fontFamily: "'Hanken Grotesk',sans-serif" }} />
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 10, marginBottom: 16 }}>
        <button onClick={() => setGeo((g) => !g)} className="font-semibold inline-flex items-center" style={{ gap: 7, padding: "9px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", color: geo ? "#0B0B0E" : C.text, background: geo ? C.goldGrad : "rgba(255,255,255,0.04)", border: `1px solid ${geo ? "transparent" : C.line}` }}>
          <MapPin size={14} /> {geo ? "Using your location" : "Use my location"}
        </button>
        {geo && <select value={radius} onChange={(e) => setRadius(e.target.value)} style={selStyle}>{Object.keys(radiusMi).map((o) => <option key={o} value={o}>{o === "Any" ? "Any distance" : `Within ${o}`}</option>)}</select>}
        {geo && <select value={sort} onChange={(e) => setSort(e.target.value)} style={selStyle}><option>Recommended</option><option>Nearest</option></select>}
        {geo && <span style={{ color: C.sub, fontSize: 12 }}>distance simulated</span>}
      </div>
      <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 22 }}>
        <Chip label="All" active={active === "all"} onClick={() => setActive("all")} />
        {CATS.map((c) => <Chip key={c.key} label={c.label} color={c.color} icon={c.icon} active={active === c.key} onClick={() => setActive(c.key)} />)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
        {list.map((p) => (
          <Card key={p.id} style={{ overflow: "hidden", cursor: "pointer" }} onClick={() => openPro(p.id)}>
            <Look k={p.cat} label="" h={140} />
            <div style={{ padding: 16 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: 10 }}>
                  <Avatar name={p.name} color={catOf(p.cat).color} size={40} />
                  <div>
                    <div className="flex items-center" style={{ gap: 5, fontWeight: 700, fontSize: 15 }}>{p.name} {p.verified && <BadgeCheck size={15} style={{ color: C.gold }} />}</div>
                    <div style={{ color: C.sub, fontSize: 12.5 }}>{p.handle}</div>
                  </div>
                </div>
                {p.crown && <Crown size={18} style={{ color: C.gold }} />}
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 14 }}>
                <CatBadge k={p.cat} small />
                <div className="flex items-center" style={{ gap: 5, fontSize: 13 }}><Stars value={p.rating} /><span style={{ fontWeight: 700 }}>{p.rating}</span><span style={{ color: C.sub }}>({p.reviews})</span></div>
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
                <span className="flex items-center" style={{ gap: 5, color: C.sub, fontSize: 12.5 }}><MapPin size={13} /> {p.city}{geo ? <b style={{ color: C.gold, marginLeft: 4 }}>· {miles(p)} mi</b> : ""}</span>
                <span style={{ fontSize: 13 }}>from <b style={{ color: C.gold }}>${p.from}</b></span>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {list.length === 0 && <div style={{ color: C.sub, textAlign: "center", padding: 50 }}>{geo ? "No pros within that distance — try widening the radius." : "No pros match that search."}</div>}
    </div>
  );
}

/* ------------------------------ reviews ----------------------------------- */
function Reviews({ pro, reviews, addReview, canReview }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState([]);
  const togglePick = (t) => setPicked((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);
  const submit = () => { if (!text.trim()) return; addReview(pro.id, { who: "You", rating, when: "just now", text: text.trim(), tags: picked, reply: null, mine: true }); setOpen(false); setText(""); setPicked([]); setRating(5); };

  return (
    <div style={{ marginTop: 30 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <SectionTitle icon={Star}>Reviews &amp; reputation</SectionTitle>
        {canReview && !open && <button onClick={() => setOpen(true)} className="font-semibold" style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>+ Leave a review</button>}
      </div>

      {/* reputation badges */}
      <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 14 }}>
        {[["Verified pro", BadgeCheck], ["On-time 96%", Clock], ["Clean space", Sparkles], [`${pro.rating}★ avg`, Star]].map(([t, Icon]) => (
          <span key={t} className="inline-flex items-center font-semibold" style={{ gap: 6, padding: "5px 11px", borderRadius: 999, fontSize: 12, color: C.gold, background: `${C.gold}12`, border: `1px solid ${C.gold}33` }}>
            <Icon size={13} /> {t}
          </span>
        ))}
      </div>

      {open && (
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: C.sub }}>Your rating</span><Stars value={rating} size={20} onPick={setRating} />
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="How was your visit?" rows={3}
            style={{ width: "100%", padding: 12, borderRadius: 11, background: C.surface2, border: `1px solid ${C.line}`, color: C.text, fontSize: 14, fontFamily: "'Hanken Grotesk',sans-serif", outline: "none", resize: "vertical" }} />
          <div className="flex flex-wrap" style={{ gap: 7, margin: "12px 0" }}>
            {REVIEW_TAGS.map((t) => (
              <button key={t} onClick={() => togglePick(t)} className="font-semibold" style={{ padding: "5px 11px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                color: picked.includes(t) ? "#0B0B0E" : C.sub, background: picked.includes(t) ? C.gold : "rgba(255,255,255,0.04)", border: `1px solid ${picked.includes(t) ? C.gold : C.line}` }}>{t}</button>
            ))}
          </div>
          <div className="flex" style={{ gap: 10 }}>
            <GoldButton onClick={submit}><Send size={15} /> Post review</GoldButton>
            <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
          </div>
        </Card>
      )}

      <div className="flex flex-col" style={{ gap: 12 }}>
        {reviews.map((r, i) => (
          <Card key={i} style={{ padding: 16 }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: 10 }}>
                <Avatar name={r.who === "You" ? "You" : r.who} color="#56C2FF" size={34} />
                <div>
                  <div className="flex items-center" style={{ gap: 6, fontWeight: 700, fontSize: 14 }}>{r.who}
                    <span className="inline-flex items-center" style={{ gap: 3, fontSize: 10.5, color: "#34D399", fontWeight: 600 }}><CheckCircle2 size={11} /> Verified visit</span>
                  </div>
                  <div style={{ color: C.sub, fontSize: 12 }}>{r.when}</div>
                </div>
              </div>
              <Stars value={r.rating} />
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.55, margin: "12px 0 0" }}>{r.text}</p>
            {r.tags && r.tags.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 6, marginTop: 10 }}>
                {r.tags.map((t) => <span key={t} style={{ fontSize: 11.5, color: C.sub, padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}` }}>{t}</span>)}
              </div>
            )}
            {r.reply && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", borderLeft: `2px solid ${C.gold}` }}>
                <div className="flex items-center" style={{ gap: 6, fontSize: 12.5, fontWeight: 700, color: C.gold, marginBottom: 4 }}><MessageSquare size={13} /> {first(pro.name)} replied</div>
                <div style={{ fontSize: 13.5, color: C.sub }}>{r.reply}</div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- pro profile -------------------------------- */
function ProProfile({ pro, back, book, fav, isFav, isOwner, reviews, addReview, submitToAwards, mySubmission }) {
  const c = catOf(pro.cat);
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 22px 48px" }}>
      <button onClick={back} className="flex items-center" style={{ gap: 6, color: C.sub, background: "none", border: "none", cursor: "pointer", fontSize: 14, marginBottom: 14, fontFamily: "'Hanken Grotesk',sans-serif" }}><ChevronLeft size={16} /> Back</button>

      <div className="relative" style={{ height: 180, borderRadius: 22, overflow: "hidden", border: `1px solid ${C.line}` }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${c.color}55, ${C.surface2}), radial-gradient(circle at 80% 10%, ${c.color}55, transparent 50%)` }} />
        {pro.crown && (
          <div className="absolute flex items-center" style={{ gap: 7, right: 14, top: 14, padding: "7px 13px", borderRadius: 999, background: "rgba(11,11,14,0.6)", border: `1px solid ${C.gold}66`, backdropFilter: "blur(6px)" }}>
            <Crown size={15} style={{ color: C.gold }} /><span style={{ fontSize: 12.5, fontWeight: 700, color: C.gold }}>{pro.crown}</span>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between flex-wrap" style={{ gap: 14, marginTop: -34, padding: "0 6px" }}>
        <div className="flex items-end" style={{ gap: 14 }}>
          <Avatar name={pro.name} color={c.color} size={84} ring />
          <div style={{ paddingBottom: 4 }}>
            <div className="flex items-center" style={{ gap: 7, fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 600 }}>{pro.name} {pro.verified && <BadgeCheck size={20} style={{ color: C.gold }} />}</div>
            <div style={{ color: C.sub, fontSize: 14 }}>{pro.handle}</div>
          </div>
        </div>
        {!isOwner && (
          <div className="flex" style={{ gap: 10 }}>
            <button onClick={fav} className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, cursor: "pointer" }}>
              <Heart size={19} style={{ color: isFav ? "#FF6FA5" : C.sub }} fill={isFav ? "#FF6FA5" : "transparent"} />
            </button>
            <GoldButton onClick={() => book(pro.services[0])}>Book now</GoldButton>
          </div>
        )}
        {isOwner && <span className="inline-flex items-center font-semibold" style={{ gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 12.5, color: C.gold, background: `${C.gold}14`, border: `1px solid ${C.gold}40` }}><Eye size={14} /> Public preview</span>}
      </div>

      <div className="flex flex-wrap items-center" style={{ gap: 18, margin: "20px 6px 6px" }}>
        <CatBadge k={pro.cat} />
        <span className="flex items-center" style={{ gap: 6, fontSize: 14 }}><Stars value={pro.rating} /> <b>{pro.rating}</b> <span style={{ color: C.sub }}>({pro.reviews} reviews)</span></span>
        <span className="flex items-center" style={{ gap: 6, color: C.sub, fontSize: 14 }}><MapPin size={15} /> {pro.city}</span>
      </div>
      <p style={{ color: C.sub, fontSize: 14.5, lineHeight: 1.6, margin: "10px 6px 26px", maxWidth: 640 }}>{pro.bio}</p>

      {/* owner: submit to awards panel */}
      {isOwner && (
        <Card style={{ padding: 18, marginBottom: 22, position: "relative", overflow: "hidden" }}>
          <div className="absolute" style={{ inset: 0, background: `radial-gradient(circle at 100% 0%, ${C.gold}22, transparent 55%)` }} />
          <div className="relative flex items-center justify-between flex-wrap" style={{ gap: 14 }}>
            <div>
              <div className="flex items-center" style={{ gap: 8, marginBottom: 5 }}><Crown size={17} style={{ color: C.gold }} /><span style={{ fontWeight: 700, fontSize: 15 }}>{catOf(pro.cat).label} of the Month</span></div>
              <div style={{ color: C.sub, fontSize: 13.5 }}>{mySubmission ? <>Submitted: <b style={{ color: C.text }}>{mySubmission}</b> · voting open</> : "Submit one completed look this month — one per category."}</div>
            </div>
            <SubmitAwards pro={pro} onSubmit={submitToAwards} submitted={!!mySubmission} />
          </div>
        </Card>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1.15fr 1fr", gap: 22 }}>
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <SectionTitle icon={ImageIcon}>Portfolio</SectionTitle>
            {isOwner && <button className="font-semibold inline-flex items-center" style={{ gap: 5, fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}><Plus size={14} /> Upload work</button>}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {pro.looks.map((l, i) => <Look key={l} k={pro.cat} label={l} h={150} beforeAfter={i % 2 === 0} />)}
          </div>
        </div>
        <div>
          <SectionTitle icon={Scissors}>Services</SectionTitle>
          <Card style={{ overflow: "hidden" }}>
            {pro.services.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between" style={{ padding: "14px 16px", borderTop: i ? `1px solid ${C.lineSoft}` : "none" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{s.name}</div>
                  <div className="flex items-center" style={{ gap: 12, color: C.sub, fontSize: 12.5, marginTop: 3 }}><span className="flex items-center" style={{ gap: 4 }}><Clock size={12} /> {s.min} min</span><span>${s.dep} deposit</span></div>
                </div>
                <div className="flex items-center" style={{ gap: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>${s.price}</span>
                  {!isOwner && <button onClick={() => book(s)} className="font-semibold" style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, background: `${C.gold}1A`, color: C.gold, border: `1px solid ${C.gold}40`, cursor: "pointer" }}>Book</button>}
                </div>
              </div>
            ))}
          </Card>
          {!isOwner && (
            <button onClick={() => book(pro.services[0])} className="flex items-center justify-center font-semibold" style={{ width: "100%", gap: 8, padding: "11px 0", marginTop: 10, borderRadius: 12, cursor: "pointer", color: C.gold, background: "transparent", border: `1px dashed ${C.gold}55`, fontSize: 13.5 }}>
              <Users size={16} /> Book for the whole household
            </button>
          )}
          <div style={{ height: 18 }} />
          <Card style={{ padding: 16, position: "relative", overflow: "hidden" }}>
            <div className="absolute" style={{ inset: 0, background: `radial-gradient(circle at 100% 0%, ${C.gold}1F, transparent 60%)` }} />
            <div className="relative flex items-center" style={{ gap: 10, marginBottom: 8 }}><Gift size={18} style={{ color: C.gold }} /><span style={{ fontWeight: 700, fontSize: 15 }}>StylePoints with {first(pro.name)}</span></div>
            <div className="relative" style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.55 }}>Earn <b style={{ color: C.text }}>2 pts</b> per $1 · <b style={{ color: C.text }}>+50</b> on rebooking · redeem 500 pts for <b style={{ color: C.text }}>15% off</b>.</div>
          </Card>
        </div>
      </div>

      <Reviews pro={pro} reviews={reviews} addReview={addReview} canReview={!isOwner} />
    </div>
  );
}

function SubmitAwards({ pro, onSubmit, submitted }) {
  const [open, setOpen] = useState(false);
  const [look, setLook] = useState(pro.looks[0]);
  const [consent, setConsent] = useState("No client tagged");
  if (submitted && !open) return <span className="inline-flex items-center font-semibold" style={{ gap: 6, padding: "10px 16px", borderRadius: 12, color: "#34D399", background: "#34D39914", border: "1px solid #34D39940" }}><Check size={15} /> Entered this month</span>;
  if (!open) return <GoldButton onClick={() => setOpen(true)}><Crown size={15} /> Submit to Awards</GoldButton>;
  return (
    <div style={{ width: "100%", maxWidth: 360 }}>
      <Select label="Choose a look to enter" value={look} onChange={setLook} options={pro.looks} />
      <div style={{ height: 10 }} />
      <Select label="Client / model tagging" value={consent} onChange={setConsent} options={["No client tagged", "Request public tag", "Request anonymous credit"]} />
      <div className="flex" style={{ gap: 10, marginTop: 12 }}>
        <GoldButton onClick={() => { onSubmit(pro.cat, look); setOpen(false); }}>Submit entry</GoldButton>
        <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
      </div>
    </div>
  );
}

/* ------------------------------ booking ----------------------------------- */
const START_TIMES = [
  { label: "9:00 AM", min: 540 }, { label: "10:30 AM", min: 630 }, { label: "12:00 PM", min: 720 },
  { label: "1:30 PM", min: 810 }, { label: "3:00 PM", min: 900 }, { label: "4:30 PM", min: 990 },
];
const fmtClock = (min) => { let h = Math.floor(min / 60), m = min % 60; const ap = h >= 12 ? "PM" : "AM"; h = h % 12; if (h === 0) h = 12; return `${h}:${String(m).padStart(2, "0")} ${ap}`; };
const fmtDur = (min) => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h${m ? " " + m + "m" : ""}` : `${m}m`; };

function Booking({ pro, seedService, household, addMember, tiers = [], marketplaceOn, avail = {}, shopProduct, close, confirm }) {
  const c = catOf(pro.cat);
  const STEPS = ["People", "Services", "Upgrade", "Date", "Time", "Confirm"];
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(["me"]);
  const [basket, setBasket] = useState({ me: seedService ? [seedService] : [] });
  const [date, setDate] = useState(null);
  const [start, setStart] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Child");
  const [joinMembership, setJoinMembership] = useState(false);
  const days = ["Mon 2", "Tue 3", "Wed 4", "Thu 5", "Fri 6", "Sat 7"];

  const toggleMember = (id) => {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
    setBasket((b) => (b[id] ? b : { ...b, [id]: [] }));
  };
  const addSvc = (id, svc) => setBasket((b) => ({ ...b, [id]: [...(b[id] || []), svc] }));
  const removeSvc = (id, idx) => setBasket((b) => ({ ...b, [id]: b[id].filter((_, i) => i !== idx) }));
  const doAdd = () => { if (!newName.trim()) return; const id = addMember(newName.trim(), newType); setNewName(""); setAdding(false); setSelected((s) => [...s, id]); setBasket((b) => ({ ...b, [id]: [] })); };
  const memberOf = (id) => household.find((x) => x.id === id) || { name: "Guest", color: C.sub };
  const primaryId = selected.find((id) => (basket[id] || []).length > 0) || selected[0];

  const lineItems = [];
  selected.forEach((id) => (basket[id] || []).forEach((svc) => lineItems.push({ memberId: id, memberName: memberOf(id).name, color: memberOf(id).color, service: svc })));
  let cursor = start != null ? start : 0;
  const scheduled = lineItems.map((li) => { const t = cursor; cursor += li.service.min; return { ...li, startMin: t }; });
  const endMin = (start != null ? start : 0) + lineItems.reduce((s, li) => s + li.service.min, 0);
  const total = lineItems.reduce((s, li) => s + li.service.price, 0);
  const depositTotal = lineItems.reduce((s, li) => s + li.service.dep, 0);
  const totalMin = lineItems.reduce((s, li) => s + li.service.min, 0);
  const peopleCount = selected.filter((id) => (basket[id] || []).length > 0).length;
  const everyoneHasService = selected.length > 0 && selected.every((id) => (basket[id] || []).length > 0);
  const summary = lineItems.length === 1 ? lineItems[0].service.name : `${lineItems.length} services · ${peopleCount} ${peopleCount === 1 ? "person" : "people"}`;

  // ---- upsell math ----
  const addOns = addonsFor(pro.cat);
  const tier = (() => {
    if (!tiers || !tiers.length) return null;
    const wins = tiers.filter((t) => t.price <= total).sort((a, b) => b.price - a.price);
    return wins.length ? wins[0] : [...tiers].sort((a, b) => a.price - b.price)[0];
  })();
  const showMembership = !!tier && total >= tier.price * 0.6;       // close enough to pitch
  const memberWins = !!tier && tier.price <= total;                 // genuinely cheaper than this basket
  const chargeNow = joinMembership && tier ? tier.price : depositTotal;
  const pts = Math.round((joinMembership && tier ? tier.price : total) * 2);

  const canNext = (step === 0 && selected.length > 0) || (step === 1 && everyoneHasService) || step === 2 || (step === 3 && date) || (step === 4 && start != null);

  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 60, background: "rgba(5,5,7,0.74)", backdropFilter: "blur(3px)" }}>
      <div style={{ width: "100%", maxWidth: 500, background: C.bg, border: `1px solid ${C.line}`, borderRadius: "22px 22px 0 0", maxHeight: "94%", overflow: "auto" }}>
        <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: `1px solid ${C.lineSoft}`, position: "sticky", top: 0, background: C.bg, zIndex: 2 }}>
          <div className="flex items-center" style={{ gap: 10 }}><Avatar name={pro.name} color={c.color} size={36} /><div><div style={{ fontWeight: 700, fontSize: 14.5 }}>{pro.name}</div><div style={{ color: C.sub, fontSize: 12 }}>{lineItems.length ? summary : "New booking"}</div></div></div>
          <button onClick={close} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}><X size={20} /></button>
        </div>

        <div className="flex" style={{ gap: 6, padding: "14px 18px 0" }}>{STEPS.map((s, i) => <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? C.gold : "rgba(255,255,255,0.1)" }} />)}</div>

        <div style={{ padding: 18 }}>
          {/* STEP 0 — people */}
          {step === 0 && (<>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 4px" }}>Who's coming?</h3>
            <p style={{ color: C.sub, fontSize: 13, margin: "0 0 14px" }}>Book for yourself, your kids, or the whole household in one go.</p>
            <div className="flex flex-col" style={{ gap: 8 }}>
              {household.map((m) => { const on = selected.includes(m.id); return (
                <button key={m.id} onClick={() => toggleMember(m.id)} className="flex items-center justify-between" style={{ padding: "11px 13px", borderRadius: 13, cursor: "pointer", background: on ? `${C.gold}12` : "rgba(255,255,255,0.03)", border: `1px solid ${on ? C.gold + "66" : C.line}` }}>
                  <span className="flex items-center" style={{ gap: 11 }}><Avatar name={m.name} color={m.color} size={34} /><span style={{ textAlign: "left" }}><span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{m.name}</span><span style={{ display: "block", color: C.sub, fontSize: 12 }}>{m.tag}</span></span></span>
                  <span className="flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 7, background: on ? C.goldGrad : "transparent", border: `1px solid ${on ? "transparent" : C.line}` }}>{on && <Check size={14} style={{ color: "#1A1306" }} />}</span>
                </button>); })}
            </div>
            {adding ? (
              <Card style={{ padding: 14, marginTop: 10 }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" autoFocus
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.line}`, color: C.text, fontSize: 14, outline: "none", fontFamily: "'Hanken Grotesk',sans-serif" }} />
                <div className="flex" style={{ gap: 7, margin: "10px 0" }}>{["Child", "Adult"].map((t) => <button key={t} onClick={() => setNewType(t)} className="font-semibold" style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", color: newType === t ? "#0B0B0E" : C.sub, background: newType === t ? C.gold : "rgba(255,255,255,0.04)", border: `1px solid ${newType === t ? C.gold : C.line}` }}>{t}</button>)}</div>
                <div className="flex" style={{ gap: 8 }}><GoldButton onClick={doAdd}><Plus size={15} /> Add</GoldButton><GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton></div>
              </Card>
            ) : (
              <button onClick={() => setAdding(true)} className="flex items-center justify-center font-semibold" style={{ width: "100%", gap: 7, padding: "12px 0", marginTop: 10, borderRadius: 13, cursor: "pointer", color: C.gold, background: "transparent", border: `1px dashed ${C.gold}55`, fontSize: 13.5 }}><Plus size={16} /> Add someone to my household</button>
            )}
          </>)}

          {/* STEP 1 — services per person */}
          {step === 1 && (<>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 4px" }}>Add services</h3>
            <p style={{ color: C.sub, fontSize: 13, margin: "0 0 14px" }}>Each person can get one or more services.</p>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {selected.map((id) => { const m = memberOf(id); const chosen = basket[id] || []; return (
                <Card key={id} style={{ padding: 14 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: chosen.length ? 10 : 4 }}>
                    <span className="flex items-center" style={{ gap: 9, fontWeight: 700, fontSize: 14 }}><Avatar name={m.name} color={m.color} size={28} /> {m.name}</span>
                    {chosen.length === 0 && <span style={{ fontSize: 12, color: "#FF8A5B" }}>Pick a service</span>}
                  </div>
                  {chosen.map((svc, i) => (
                    <div key={i} className="flex items-center justify-between" style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", marginBottom: 6 }}>
                      <span style={{ fontSize: 13.5 }}><b>{svc.name}</b> <span style={{ color: C.sub }}>· {svc.min}m · ${svc.price}</span></span>
                      <button onClick={() => removeSvc(id, i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}><X size={15} /></button>
                    </div>
                  ))}
                  <div className="flex flex-wrap" style={{ gap: 6, marginTop: 6 }}>
                    {pro.services.map((svc) => (
                      <button key={svc.name} onClick={() => addSvc(id, svc)} className="font-semibold inline-flex items-center" style={{ gap: 5, padding: "6px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer", color: C.gold, background: `${C.gold}12`, border: `1px solid ${C.gold}33` }}><Plus size={12} /> {svc.name} <span style={{ color: C.sub }}>${svc.price}</span></button>
                    ))}
                  </div>
                </Card>); })}
            </div>
            {lineItems.length > 0 && <div className="flex items-center justify-between" style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}` }}><span style={{ color: C.sub, fontSize: 13 }}>{lineItems.length} services · {fmtDur(totalMin)} total</span><span style={{ fontWeight: 800, fontSize: 16 }}>${total}</span></div>}
          </>)}

          {/* STEP 2 — upgrade / upsell */}
          {step === 2 && (<>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 4px" }}>Before you book</h3>
            <p style={{ color: C.sub, fontSize: 13, margin: "0 0 14px" }}>{showMembership ? "Worth a look — this might be cheaper as a membership." : "Clients often add these."}</p>

            {showMembership && (
              <Card style={{ padding: 4, marginBottom: 14, border: `1px solid ${C.gold}40`, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px 6px" }}>
                  <div className="flex items-center" style={{ gap: 8, marginBottom: 2 }}><Crown size={16} style={{ color: C.gold }} /><span style={{ fontWeight: 700, fontSize: 14.5 }}>{tier.name}</span>{memberWins && <span className="font-semibold" style={{ fontSize: 10.5, color: "#0B0B0E", background: C.goldGrad, padding: "2px 8px", borderRadius: 999 }}>BEST VALUE</span>}</div>
                  <div style={{ color: C.sub, fontSize: 12.5 }}>{tier.includes} · {tier.perks.join(" · ")}</div>
                </div>
                <div style={{ padding: 8 }}>
                  <button onClick={() => setJoinMembership(false)} className="flex items-center justify-between" style={{ width: "100%", padding: "11px 12px", borderRadius: 11, marginBottom: 7, cursor: "pointer", background: !joinMembership ? `${C.gold}12` : "rgba(255,255,255,0.03)", border: `1px solid ${!joinMembership ? C.gold + "66" : C.line}` }}>
                    <span className="flex items-center" style={{ gap: 9 }}><span className="flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 18, border: `2px solid ${!joinMembership ? C.gold : C.sub}` }}>{!joinMembership && <span style={{ width: 8, height: 8, borderRadius: 8, background: C.gold }} />}</span><span style={{ fontSize: 13.5, fontWeight: 600 }}>Pay à la carte</span></span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>${total} today</span>
                  </button>
                  <button onClick={() => setJoinMembership(true)} className="flex items-center justify-between" style={{ width: "100%", padding: "11px 12px", borderRadius: 11, cursor: "pointer", background: joinMembership ? `${C.gold}12` : "rgba(255,255,255,0.03)", border: `1px solid ${joinMembership ? C.gold + "66" : C.line}` }}>
                    <span className="flex items-center" style={{ gap: 9 }}><span className="flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 18, border: `2px solid ${joinMembership ? C.gold : C.sub}` }}>{joinMembership && <span style={{ width: 8, height: 8, borderRadius: 8, background: C.gold }} />}</span><span style={{ textAlign: "left" }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Join {tier.name}</span><span style={{ display: "block", fontSize: 11.5, color: C.sub }}>this visit included · cancel anytime</span></span></span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: C.gold }}>${tier.price}/mo</span>
                  </button>
                </div>
              </Card>
            )}

            {addOns.length > 0 && (<>
              <div className="flex items-center" style={{ gap: 7, margin: "4px 0 10px", color: C.sub, fontSize: 12.5, fontWeight: 600 }}><Plus size={13} style={{ color: C.gold }} /> FREQUENTLY ADDED{primaryId && <span style={{ fontWeight: 400 }}>· for {memberOf(primaryId).name}</span>}</div>
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                {addOns.map((a) => (
                  <button key={a.name} onClick={() => addSvc(primaryId, a)} className="font-semibold inline-flex items-center" style={{ gap: 6, padding: "9px 13px", borderRadius: 12, fontSize: 13, cursor: "pointer", color: C.text, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}` }}>
                    <Plus size={13} style={{ color: C.gold }} /> {a.name} <span style={{ color: C.gold, fontWeight: 700 }}>+${a.price}</span>
                  </button>
                ))}
              </div>
              <p style={{ color: C.sub, fontSize: 12, marginTop: 12 }}>Optional — skip straight ahead if you're all set.</p>
            </>)}
          </>)}

          {/* STEP 3 — date */}
          {step === 3 && (<>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 14px" }}>Pick a day</h3>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>{days.map((d) => <button key={d} onClick={() => setDate(d)} className="font-semibold" style={{ padding: "16px 0", borderRadius: 14, cursor: "pointer", fontSize: 14, color: date === d ? "#0B0B0E" : C.text, background: date === d ? C.goldGrad : "rgba(255,255,255,0.04)", border: `1px solid ${date === d ? "transparent" : C.line}` }}>{d}</button>)}</div>
          </>)}

          {/* STEP 4 — start time + computed schedule */}
          {step === 4 && (<>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 4px" }}>Pick a start time · {date}</h3>
            <p style={{ color: C.sub, fontSize: 13, margin: "0 0 14px" }}>Appointments run back-to-back with {first(pro.name)} ({fmtDur(totalMin)} total).</p>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>{START_TIMES.map((t) => <button key={t.min} onClick={() => setStart(t.min)} className="font-semibold" style={{ padding: "13px 0", borderRadius: 12, cursor: "pointer", fontSize: 13.5, color: start === t.min ? "#0B0B0E" : C.text, background: start === t.min ? C.goldGrad : "rgba(255,255,255,0.04)", border: `1px solid ${start === t.min ? "transparent" : C.line}` }}>{t.label}</button>)}</div>
            {start != null && (
              <Card style={{ padding: 14, marginTop: 16 }}>
                <div style={{ fontSize: 12.5, color: C.sub, fontWeight: 600, marginBottom: 8 }}>YOUR SCHEDULE</div>
                {scheduled.map((s, i) => (
                  <div key={i} className="flex items-center" style={{ gap: 12, padding: "7px 0", borderTop: i ? `1px solid ${C.lineSoft}` : "none" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.gold, width: 64 }}>{fmtClock(s.startMin)}</span>
                    <span style={{ fontSize: 13.5 }}><b>{s.service.name}</b> <span style={{ color: C.sub }}>· {s.memberName}</span></span>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: C.sub, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.lineSoft}` }}>Ends around {fmtClock(endMin)}</div>
              </Card>
            )}
          </>)}

          {/* STEP 4 — confirm */}
          {/* STEP 5 — confirm */}
          {step === 5 && (<>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 14px" }}>Confirm booking</h3>
            <Card style={{ padding: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10, color: C.sub, fontSize: 13 }}><span>{date}</span><span>{peopleCount} {peopleCount === 1 ? "person" : "people"} · {fmtDur(totalMin)}</span></div>
              {selected.filter((id) => (basket[id] || []).length).map((id) => { const m = memberOf(id); return (
                <div key={id} style={{ marginBottom: 12 }}>
                  <div className="flex items-center" style={{ gap: 8, fontWeight: 700, fontSize: 13.5, marginBottom: 5 }}><Avatar name={m.name} color={m.color} size={22} /> {m.name}</div>
                  {(basket[id] || []).map((svc, i) => { const li = scheduled.find((x) => x.memberId === id && x.service === svc); return (
                    <div key={i} className="flex items-center justify-between" style={{ padding: "4px 0 4px 30px", fontSize: 13.5 }}><span style={{ color: C.sub }}>{li ? fmtClock(li.startMin) : ""} · {svc.name}</span><span style={{ fontWeight: 600 }}>${svc.price}</span></div>); })}
                </div>); })}
              <div className="flex items-center justify-between" style={{ padding: "8px 0", borderTop: `1px solid ${C.lineSoft}`, color: C.sub, fontSize: 14 }}><span>Service total</span><span style={{ color: C.text, fontWeight: 600 }}>${total}</span></div>
              {joinMembership && tier && (
                <div className="flex items-center justify-between" style={{ padding: "8px 0 0", color: C.gold, fontSize: 14 }}><span className="flex items-center" style={{ gap: 6 }}><Crown size={14} /> {tier.name} — this visit included</span><span style={{ fontWeight: 700 }}>${tier.price}/mo</span></div>
              )}
              <div className="flex items-center justify-between" style={{ padding: "8px 0 2px", marginTop: 6, borderTop: `1px solid ${C.lineSoft}` }}><span style={{ fontWeight: 700 }}>{joinMembership && tier ? "Due now (first month)" : "Due now (combined deposit)"}</span><span style={{ fontWeight: 800, color: C.gold, fontSize: 18 }}>${chargeNow}</span></div>
            </Card>
            <div className="flex items-center" style={{ gap: 8, marginTop: 14, color: C.gold, fontSize: 13.5 }}><Sparkles size={15} /> The household earns <b>+{pts} StylePoints</b> after these visits.</div>
            <p style={{ color: C.sub, fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>{joinMembership && tier ? `Membership renews at $${tier.price}/mo. Cancel anytime. (Billing simulated.)` : "One combined deposit secures every slot and applies to your total. Cancellations within 24h forfeit the deposit. (Payment simulated.)"}</p>
            {marketplaceOn && shopProduct && (() => {
              const used = PRODUCTS.filter((p) => avail[p.id] && (p.usedBy === pro.id || p.cat === ({ barber: "beard", colorist: "hair", stylist: "hair", braider: "hair", loctician: "hair", nail: "nails", lash: "skin", makeup: "skin" }[pro.cat] || "hair"))).slice(0, 3);
              if (!used.length) return null;
              return (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.lineSoft}` }}>
                  <div className="flex items-center" style={{ gap: 7, marginBottom: 10, fontSize: 12.5, fontWeight: 600, color: C.sub }}><ShoppingBag size={13} style={{ color: C.gold }} /> SHOP WHAT {first(pro.name).toUpperCase()} USES</div>
                  <div className="flex flex-col" style={{ gap: 8 }}>
                    {used.map((p) => (
                      <div key={p.id} className="flex items-center justify-between" style={{ padding: "8px 10px", borderRadius: 11, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}` }}>
                        <span style={{ fontSize: 13 }}><b>{p.name}</b> <span style={{ color: C.sub }}>· {p.brand} · ${p.price}</span></span>
                        <button onClick={() => shopProduct(p.id)} className="font-semibold inline-flex items-center" style={{ gap: 5, padding: "6px 11px", borderRadius: 9, fontSize: 12, cursor: "pointer", color: C.gold, background: `${C.gold}14`, border: `1px solid ${C.gold}40` }}><Plus size={12} /> Add</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>)}
        </div>

        <div className="flex" style={{ gap: 10, padding: "0 18px 22px" }}>
          {step > 0 && <GhostButton onClick={() => setStep(step - 1)}><ChevronLeft size={16} /> Back</GhostButton>}
          {step < 5 && <GoldButton full disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 2 && !joinMembership ? "Skip & continue" : "Continue"} <ArrowRight size={16} /></GoldButton>}
          {step === 5 && <GoldButton full onClick={() => confirm({ pro, date, startTime: fmtClock(start), pts, depositTotal: chargeNow, total, totalMin, people: peopleCount === 1 ? (scheduled[0] ? scheduled[0].memberName : "You") : `${peopleCount} people`, summary, lineItems: scheduled.map((s) => ({ memberName: s.memberName, service: s.service, time: fmtClock(s.startMin) })), membership: joinMembership && tier ? { proId: pro.id, proName: pro.name, name: tier.name, price: tier.price } : null })}>{joinMembership && tier ? `Join & pay $${chargeNow}` : `Pay $${chargeNow} deposit & book`} <Check size={17} /></GoldButton>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- appointments -------------------------------- */
const SEED_PAST = [
  { id: "pa1", proId: "p5", summary: "Gel-X Full Set", date: "May 12", startTime: "2:00 PM", reviewed: false },
  { id: "pa2", proId: "p1", summary: "Signature Fade", date: "Apr 28", startTime: "3:30 PM", reviewed: true },
  { id: "pa3", proId: "p2", summary: "Silk Press", date: "Apr 9", startTime: "11:00 AM", reviewed: false },
];

function Appointments({ appts, cancelAppt, onRebook, openPro }) {
  const upcoming = appts;
  const past = SEED_PAST.map((x) => ({ ...x, pro: proById(x.proId) }));
  const ProRow = ({ pro, children }) => {
    const c = catOf(pro.cat);
    return (
      <div className="flex items-center" style={{ gap: 12 }}>
        <Avatar name={pro.name} color={c.color} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    );
  };
  const ActBtn = ({ onClick, children, danger }) => (
    <button onClick={onClick} className="font-semibold inline-flex items-center" style={{ gap: 6, padding: "8px 13px", borderRadius: 10, fontSize: 12.5, cursor: "pointer",
      color: danger ? "#FF6FA5" : C.gold, background: danger ? "#FF6FA514" : `${C.gold}14`, border: `1px solid ${danger ? "#FF6FA540" : C.gold + "40"}` }}>{children}</button>
  );
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "26px 22px 48px" }}>
      <div className="flex items-center" style={{ gap: 10 }}><Calendar size={24} style={{ color: C.gold }} /><H2>My appointments</H2></div>
      <p style={{ color: C.sub, fontSize: 14, margin: "6px 0 20px" }}>Everything you've got booked, and everywhere you've been.</p>

      <SectionTitle icon={Clock}>Upcoming</SectionTitle>
      {upcoming.length === 0 && <Card style={{ padding: 26, textAlign: "center", color: C.sub }}><Calendar size={24} style={{ color: C.sub, marginBottom: 8 }} /><div>No upcoming appointments — find a pro to book.</div></Card>}
      <div className="flex flex-col" style={{ gap: 12 }}>
        {upcoming.map((a) => {
          const svc = (a.lineItems && a.lineItems[0] && a.lineItems[0].service) || a.pro.services[0];
          return (
            <Card key={a.id} style={{ padding: 16 }}>
              <ProRow pro={a.pro}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{ gap: 5, fontWeight: 700, fontSize: 15 }}>{a.pro.name} {a.pro.verified && <BadgeCheck size={14} style={{ color: C.gold }} />}</div>
                  <span className="font-semibold" style={{ fontSize: 11, color: "#34D399", background: "#34D39914", padding: "3px 9px", borderRadius: 999, border: "1px solid #34D39940" }}>Deposit paid</span>
                </div>
                <div style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{a.summary}</div>
              </ProRow>
              <div className="flex items-center" style={{ gap: 14, marginTop: 12, color: C.text, fontSize: 13.5 }}>
                <span className="flex items-center" style={{ gap: 6 }}><Calendar size={14} style={{ color: C.gold }} /> {a.date}</span>
                <span className="flex items-center" style={{ gap: 6 }}><Clock size={14} style={{ color: C.gold }} /> {a.startTime}</span>
                {a.people && a.people.includes("people") && <span className="flex items-center" style={{ gap: 6, color: C.sub }}><Users size={14} /> {a.people}</span>}
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
                <span style={{ color: C.sub, fontSize: 11.5 }}>Free to cancel until 24h before</span>
                <div className="flex" style={{ gap: 8 }}>
                  <ActBtn onClick={() => onRebook(a.pro, svc)}>Reschedule</ActBtn>
                  <ActBtn danger onClick={() => cancelAppt(a.id)}>Cancel</ActBtn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <SectionTitle icon={Repeat} top={28}>Past visits</SectionTitle>
      <div className="flex flex-col" style={{ gap: 12 }}>
        {past.map((a) => (
          <Card key={a.id} style={{ padding: 16 }}>
            <ProRow pro={a.pro}>
              <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: 5, fontWeight: 700, fontSize: 15 }}>{a.pro.name}</div>
                <span style={{ color: C.sub, fontSize: 12.5 }}>{a.date}</span>
              </div>
              <div style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{a.summary}</div>
            </ProRow>
            <div className="flex items-center justify-between" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
              {a.reviewed
                ? <span className="flex items-center" style={{ gap: 6, color: C.sub, fontSize: 12 }}><CheckCircle2 size={13} style={{ color: "#34D399" }} /> You reviewed this visit</span>
                : <span className="flex items-center" style={{ gap: 6, color: C.gold, fontSize: 12 }}><Star size={13} /> How was it?</span>}
              <div className="flex" style={{ gap: 8 }}>
                {!a.reviewed && <ActBtn onClick={() => openPro(a.proId)}>Leave a review</ActBtn>}
                <ActBtn onClick={() => onRebook(a.pro, a.pro.services[0])}><Repeat size={13} /> Rebook</ActBtn>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- wallet ----------------------------------- */
function Wallet({ points, tier, redeem, appts, memberships = [] }) {
  const next = 1000; const pct = Math.min(100, (points / next) * 100);
  const rewards = [ { name: "15% off next visit", cost: 500 }, { name: "Free add-on service", cost: 750 }, { name: "$25 booking credit", cost: 1000 } ];
  const tx = [ ...appts.map((a) => ({ t: `${a.summary || (a.service && a.service.name) || "Booking"} · ${a.pro.name}`, p: `+${a.pts}`, pos: true })),
    { t: "Left a review · Imani Brooks", p: "+40", pos: true }, { t: "Referral bonus · invited Jordan", p: "+100", pos: true },
    { t: "Redeemed 15% off", p: "-500", pos: false }, { t: "Birthday bonus", p: "+150", pos: true } ];
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "26px 22px 48px" }}>
      <H2>StylePoints wallet</H2><div style={{ height: 14 }} />
      <Card style={{ padding: 24, position: "relative", overflow: "hidden" }}>
        <div className="absolute" style={{ inset: 0, background: `radial-gradient(circle at 90% -10%, ${C.gold}33, transparent 55%)` }} />
        <div className="relative flex items-center justify-between">
          <div><div style={{ color: C.sub, fontSize: 13 }}>Balance</div><div style={{ fontFamily: "'Fraunces',serif", fontSize: 46, fontWeight: 600, lineHeight: 1 }}>{points.toLocaleString()} <span style={{ fontSize: 18, color: C.gold }}>pts</span></div></div>
          <div className="flex items-center" style={{ gap: 7, padding: "8px 14px", borderRadius: 999, background: "rgba(11,11,14,0.5)", border: `1px solid ${C.gold}55` }}><Crown size={15} style={{ color: C.gold }} /> <span style={{ fontWeight: 700, fontSize: 13, color: C.gold }}>{tier} tier</span></div>
        </div>
        <div className="relative" style={{ marginTop: 22 }}><div style={{ height: 8, borderRadius: 8, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: C.goldGrad }} /></div>
          <div style={{ color: C.sub, fontSize: 12.5, marginTop: 8 }}>{Math.max(0, next - points)} pts to <b style={{ color: C.text }}>Gold</b> tier perks</div></div>
      </Card>
      {memberships.length > 0 && (<>
        <SectionTitle icon={Crown} top={24}>Your memberships</SectionTitle>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {memberships.map((m) => (
            <Card key={m.proId} style={{ padding: 16, position: "relative", overflow: "hidden" }}>
              <div className="absolute" style={{ inset: 0, background: `radial-gradient(circle at 100% 0%, ${C.gold}1F, transparent 60%)` }} />
              <div className="relative flex items-center justify-between">
                <div>
                  <div className="flex items-center" style={{ gap: 7, fontWeight: 700, fontSize: 14.5 }}><Crown size={15} style={{ color: C.gold }} /> {m.name}</div>
                  <div style={{ color: C.sub, fontSize: 12.5, marginTop: 3 }}>with {m.proName} · ${m.price}/mo</div>
                </div>
                <span className="font-semibold" style={{ fontSize: 11, color: "#34D399", background: "#34D39914", padding: "4px 9px", borderRadius: 999, border: "1px solid #34D39940" }}>Active</span>
              </div>
            </Card>
          ))}
        </div>
      </>)}
      <SectionTitle icon={Gift} top={24}>Redeem rewards</SectionTitle>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {rewards.map((r) => { const ok = points >= r.cost; return (
          <Card key={r.name} style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.name}</div><div style={{ color: C.sub, fontSize: 12.5, margin: "4px 0 12px" }}>{r.cost} pts</div>
            <button onClick={() => ok && redeem(r.cost, r.name)} disabled={!ok} className="font-semibold" style={{ width: "100%", padding: "9px 0", borderRadius: 10, fontSize: 13, cursor: ok ? "pointer" : "not-allowed", background: ok ? `${C.gold}1A` : "rgba(255,255,255,0.04)", color: ok ? C.gold : C.sub, border: `1px solid ${ok ? C.gold + "40" : C.line}` }}>{ok ? "Redeem" : "Not enough"}</button>
          </Card>); })}
      </div>
      <SectionTitle icon={Repeat} top={26}>Activity</SectionTitle>
      <Card style={{ overflow: "hidden" }}>{tx.map((t, i) => <div key={i} className="flex items-center justify-between" style={{ padding: "13px 16px", borderTop: i ? `1px solid ${C.lineSoft}` : "none" }}><span style={{ fontSize: 14 }}>{t.t}</span><span style={{ fontWeight: 700, fontSize: 14, color: t.pos ? "#34D399" : C.sub }}>{t.p}</span></div>)}</Card>
    </div>
  );
}

/* ---------------------------- tag / consent ------------------------------- */
function TagRequests({ requests, resolve }) {
  const OPTIONS = [
    { key: "public", label: "Public tag", icon: Globe, desc: "Name, photo & your profile can appear on the post.", color: "#34D399" },
    { key: "private", label: "Private approval", icon: Lock, desc: "Image can be used, but your profile isn't linked.", color: "#56C2FF" },
    { key: "anonymous", label: "Anonymous", icon: EyeOff, desc: "Post can say \u201CModel approved\u201D — identity stays hidden.", color: "#A78BFA" },
    { key: "declined", label: "Decline", icon: Ban, desc: "They can't tag or publicly identify you.", color: "#FF6FA5" },
  ];
  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "26px 22px 48px" }}>
      <div className="flex items-center" style={{ gap: 10 }}><Tag size={24} style={{ color: C.gold }} /><H2>Tag &amp; consent requests</H2></div>
      <p style={{ color: C.sub, fontSize: 14, margin: "6px 0 20px" }}>Pros want to feature you in their work. You decide how — consent is required before anything goes public.</p>

      {pending.length === 0 && <Card style={{ padding: 28, textAlign: "center", color: C.sub }}><Inbox size={26} style={{ color: C.sub, marginBottom: 8 }} /><div>No pending requests right now.</div></Card>}

      <div className="flex flex-col" style={{ gap: 16 }}>
        {pending.map((r) => { const pro = proById(r.proId); const c = catOf(pro.cat); return (
          <Card key={r.id} style={{ padding: 18 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <div className="flex items-center" style={{ gap: 12 }}>
                <Avatar name={pro.name} color={c.color} size={42} />
                <div>
                  <div className="flex items-center" style={{ gap: 6, fontWeight: 700, fontSize: 15 }}>{pro.name} {pro.verified && <BadgeCheck size={15} style={{ color: C.gold }} />}</div>
                  <div style={{ color: C.sub, fontSize: 13 }}>wants to feature your <b style={{ color: C.text }}>{r.look}</b></div>
                </div>
              </div>
              {r.forContest && <span className="inline-flex items-center font-semibold" style={{ gap: 5, fontSize: 11.5, color: C.gold, padding: "5px 10px", borderRadius: 999, background: `${C.gold}14`, border: `1px solid ${C.gold}40` }}><Crown size={12} /> Contest entry</span>}
            </div>
            <Look k={pro.cat} label={r.look} h={120} beforeAfter />
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              {OPTIONS.map((o) => { const Icon = o.icon; return (
                <button key={o.key} onClick={() => resolve(r.id, o.key, pro)} className="text-left" style={{ padding: 12, borderRadius: 13, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}` }}>
                  <div className="flex items-center" style={{ gap: 7, fontWeight: 700, fontSize: 13.5, color: o.color, marginBottom: 4 }}><Icon size={14} /> {o.label}</div>
                  <div style={{ color: C.sub, fontSize: 12, lineHeight: 1.45 }}>{o.desc}</div>
                </button>); })}
            </div>
          </Card>); })}
      </div>

      {resolved.length > 0 && (<>
        <SectionTitle icon={Check} top={26}>Resolved</SectionTitle>
        <Card style={{ overflow: "hidden" }}>
          {resolved.map((r, i) => { const pro = proById(r.proId); const labels = { public: "Public tag", private: "Private", anonymous: "Anonymous", declined: "Declined" }; return (
            <div key={r.id} className="flex items-center justify-between" style={{ padding: "13px 16px", borderTop: i ? `1px solid ${C.lineSoft}` : "none" }}>
              <span style={{ fontSize: 14 }}>{pro.name} · {r.look}</span>
              <span className="font-semibold" style={{ fontSize: 12.5, color: r.status === "declined" ? "#FF6FA5" : "#34D399" }}>{labels[r.status]}</span>
            </div>); })}
        </Card></>)}
    </div>
  );
}

/* ---------------------------- fill my chair ------------------------------- */
function FillMyChair({ promos, create, claim }) {
  const me = proById("p1");
  const [day, setDay] = useState("Today"); const [time, setTime] = useState("3:00 PM");
  const [svc, setSvc] = useState(me.services[0].name); const [type, setType] = useState("Last-minute opening");
  const [discount, setDiscount] = useState("None"); const [audience, setAudience] = useState("Loyalty members");
  const [slots, setSlots] = useState("3 slots"); const [expires, setExpires] = useState("3 hours");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const reach = { "Waitlist": 8, "Loyalty members": 42, "All followers": 210 };
  const expHours = { "1 hour": 1, "3 hours": 3, "Today (6h)": 6 };
  const fmtLeft = (ms) => { if (ms <= 0) return "Expired"; const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000); return h ? `${h}h ${m}m left` : m ? `${m}m ${s}s left` : `${s}s left`; };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "26px 22px 48px" }}>
      <div className="flex items-center" style={{ gap: 10 }}><Megaphone size={24} style={{ color: C.gold }} /><H2>Fill My Chair</H2></div>
      <p style={{ color: C.sub, fontSize: 14, margin: "6px 0 20px" }}>Turn cancellations and slow days into booked appointments — post a time-sensitive flash deal with limited slots and blast it to the right clients.</p>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <Card style={{ padding: 18, alignSelf: "start" }}>
          <SectionTitle icon={Zap}>Post a flash deal</SectionTitle>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select label="Day" value={day} onChange={setDay} options={["Today", "Tomorrow", "This Saturday"]} />
            <Select label="Time" value={time} onChange={setTime} options={["9:00 AM", "12:00 PM", "3:00 PM", "4:30 PM", "6:00 PM"]} />
          </div>
          <div style={{ height: 12 }} />
          <Select label="Service" value={svc} onChange={setSvc} options={me.services.map((s) => s.name)} />
          <div style={{ height: 12 }} />
          <Select label="Deal type" value={type} onChange={setType} options={["Last-minute opening", "Cancellation fill", "Slow-day discount"]} />
          <div style={{ height: 12 }} />
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select label="Discount" value={discount} onChange={setDiscount} options={["None", "10% off", "15% off", "20% off"]} />
            <Select label="Notify" value={audience} onChange={setAudience} options={["Waitlist", "Loyalty members", "All followers"]} />
          </div>
          <div style={{ height: 12 }} />
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select label="Slots" value={slots} onChange={setSlots} options={["2 slots", "3 slots", "5 slots", "8 slots"]} />
            <Select label="Expires in" value={expires} onChange={setExpires} options={["1 hour", "3 hours", "Today (6h)"]} />
          </div>
          <div style={{ color: C.sub, fontSize: 12.5, margin: "14px 0 4px" }}>Will reach <b style={{ color: C.gold }}>{reach[audience]}</b> clients · deposit still required to claim</div>
          <GoldButton full onClick={() => create({ day, time, svc, type, discount, audience, notified: reach[audience], slots: parseInt(slots, 10), expiresAt: Date.now() + expHours[expires] * 3600000 })}><Megaphone size={15} /> Blast this deal</GoldButton>
        </Card>

        <div>
          <SectionTitle icon={Clock}>Active deals</SectionTitle>
          {promos.length === 0 && <Card style={{ padding: 24, textAlign: "center", color: C.sub }}>No flash deals running yet.</Card>}
          <div className="flex flex-col" style={{ gap: 12 }}>
            {promos.map((p) => {
              const left = (p.expiresAt || 0) - now;
              const full = p.slotsClaimed >= p.slots;
              const expired = left <= 0;
              const closed = full || expired;
              const pct = Math.round((p.slotsClaimed / p.slots) * 100);
              return (
                <Card key={p.id} style={{ padding: 16, opacity: closed ? 0.7 : 1 }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center" style={{ gap: 8 }}>
                      <span className="inline-flex items-center font-semibold" style={{ gap: 5, fontSize: 11.5, padding: "4px 9px", borderRadius: 999, color: C.gold, background: `${C.gold}14`, border: `1px solid ${C.gold}40` }}>
                        {p.type === "Slow-day discount" ? <DollarSign size={11} /> : p.type === "Cancellation fill" ? <Repeat size={11} /> : <Zap size={11} />} {p.type}
                      </span>
                      {p.discount !== "None" && <span style={{ fontSize: 12, color: "#34D399", fontWeight: 700 }}>{p.discount}</span>}
                    </div>
                    <span className="inline-flex items-center font-semibold" style={{ gap: 5, fontSize: 11.5, color: closed ? C.sub : left < 600000 ? "#FF6FA5" : C.gold }}>
                      <Clock size={12} /> {full ? "Sold out" : fmtLeft(left)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 10 }}>{p.svc}</div>
                  <div style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{p.day} · {p.time}</div>
                  <div style={{ marginTop: 12 }}>
                    <div className="flex items-center justify-between" style={{ fontSize: 12.5, marginBottom: 6 }}>
                      <span style={{ color: C.sub }}>{p.slotsClaimed} / {p.slots} slots claimed</span>
                      <span className="flex items-center" style={{ gap: 5, color: C.sub }}><Users size={12} /> {p.notified} notified</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 7, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: C.goldGrad }} /></div>
                  </div>
                  <div className="flex items-center justify-end" style={{ marginTop: 12 }}>
                    {closed
                      ? <span className="font-semibold" style={{ fontSize: 12, color: full ? "#34D399" : C.sub }}>{full ? "Filled — deposits secured" : "Expired"}</span>
                      : <button onClick={() => claim(p.id)} className="font-semibold" style={{ padding: "7px 13px", borderRadius: 10, fontSize: 12.5, background: `${C.gold}1A`, color: C.gold, border: `1px solid ${C.gold}40`, cursor: "pointer" }}>Simulate claim</button>}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------ notification preferences ------------------------ */
function NotifPrefs({ prefs, setPref, back }) {
  const cats = [
    { key: "deals", label: "Flash deals & offers" },
    { key: "reminders", label: "Booking reminders" },
    { key: "announcements", label: "Announcements" },
    { key: "awards", label: "Monthly Awards" },
    { key: "lineup", label: "The Lineup" },
  ];
  const hours = ["Off", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM"];
  const hours2 = ["Off", "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM"];
  const Toggle = ({ on, onClick }) => (
    <button onClick={onClick} style={{ width: 40, height: 23, borderRadius: 999, position: "relative", cursor: "pointer", border: "none", background: on ? C.gold : "rgba(255,255,255,0.14)", transition: "background .2s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
    </button>
  );
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 22px 48px" }}>
      <button onClick={back} className="flex items-center" style={{ gap: 6, color: C.sub, background: "none", border: "none", cursor: "pointer", fontSize: 14, marginBottom: 14, fontFamily: "'Hanken Grotesk',sans-serif" }}><ChevronLeft size={16} /> Back</button>
      <div className="flex items-center" style={{ gap: 10 }}><Settings size={24} style={{ color: C.gold }} /><H2>Notification settings</H2></div>
      <p style={{ color: C.sub, fontSize: 14, margin: "6px 0 20px" }}>Choose what you hear about and how. You're always in control — this is how we keep notifications useful, not noisy.</p>

      <Card style={{ overflow: "hidden" }}>
        <div className="flex items-center justify-between" style={{ padding: "12px 16px", borderBottom: `1px solid ${C.lineSoft}` }}>
          <span style={{ fontSize: 12.5, color: C.sub, fontWeight: 600 }}>CATEGORY</span>
          <div className="flex items-center" style={{ gap: 24 }}>
            <span className="flex items-center" style={{ gap: 5, fontSize: 12, color: C.sub }}><Bell size={13} /> In-app</span>
            <span className="flex items-center" style={{ gap: 5, fontSize: 12, color: C.sub }}><Mail size={13} /> Email</span>
          </div>
        </div>
        {cats.map((c, i) => (
          <div key={c.key} className="flex items-center justify-between" style={{ padding: "14px 16px", borderTop: i ? `1px solid ${C.lineSoft}` : "none" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</span>
            <div className="flex items-center" style={{ gap: 28 }}>
              <Toggle on={prefs[c.key].inApp} onClick={() => setPref(c.key, "inApp", !prefs[c.key].inApp)} />
              <Toggle on={prefs[c.key].email} onClick={() => setPref(c.key, "email", !prefs[c.key].email)} />
            </div>
          </div>
        ))}
      </Card>

      <SectionTitle icon={Clock} top={24}>Quiet hours</SectionTitle>
      <Card style={{ padding: 16 }}>
        <p style={{ color: C.sub, fontSize: 13, margin: "0 0 14px" }}>Pause non-urgent notifications overnight.</p>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label="From" value={prefs.quietStart} onChange={(v) => setPref("quietStart", null, v)} options={hours} />
          <Select label="Until" value={prefs.quietEnd} onChange={(v) => setPref("quietEnd", null, v)} options={hours2} />
        </div>
      </Card>
      <p style={{ color: C.sub, fontSize: 11.5, marginTop: 16, opacity: 0.7 }}>Email includes a one-tap unsubscribe in every message (required by law). Preferences are simulated in this prototype.</p>
    </div>
  );
}

/* ------------------------------- awards ----------------------------------- */
function Awards({ votes, vote, voted, winners }) {
  const [tab, setTab] = useState("barber"); const c = catOf(tab);
  const entries = PROS.filter((p) => p.cat === tab);
  const entryVotes = (id) => (votes[tab] && votes[tab][id]) || 0;
  const ranked = [...entries].sort((a, b) => entryVotes(b.id) - entryVotes(a.id));
  const winnerId = winners[tab];
  const phase = [ { label: "Submissions", days: "Days 1–20", done: true }, { label: "Voting", days: "Days 21–27", active: true }, { label: "Review", days: "Days 28–29" }, { label: "Winners", days: "Last day" } ];
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 22px 48px" }}>
      <div className="flex items-center" style={{ gap: 10 }}><Crown size={26} style={{ color: C.gold }} /><h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 600, margin: 0 }}>Monthly Awards</h2></div>
      <p style={{ color: C.sub, fontSize: 14, margin: "6px 0 18px" }}>Clients vote. Winners get the crown, the badge, and a month of featured placement.</p>
      <Card style={{ padding: 16, marginBottom: 20 }}>
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          {phase.map((p, i) => (<React.Fragment key={p.label}>
            <div className="flex flex-col items-center" style={{ flex: 1, textAlign: "center" }}>
              <div className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 30, marginBottom: 8, background: p.active ? C.goldGrad : p.done ? `${C.gold}26` : "rgba(255,255,255,0.05)", border: `1px solid ${p.active || p.done ? C.gold + "66" : C.line}` }}>{p.done ? <Check size={15} style={{ color: C.gold }} /> : <span style={{ fontSize: 12, fontWeight: 700, color: p.active ? "#0B0B0E" : C.sub }}>{i + 1}</span>}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: p.active ? C.gold : C.text }}>{p.label}</div><div style={{ fontSize: 11, color: C.sub }}>{p.days}</div>
            </div>
            {i < phase.length - 1 && <div style={{ height: 1, flex: 0.5, background: C.line, marginBottom: 28 }} />}
          </React.Fragment>))}
        </div>
      </Card>
      <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 18 }}>{CATS.map((cat) => <Chip key={cat.key} label={`${cat.label} of the Month`} color={cat.color} icon={cat.icon} active={tab === cat.key} onClick={() => setTab(cat.key)} />)}</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
        {ranked.map((p, i) => {
          const v = entryVotes(p.id); const isWinner = winnerId === p.id; const leader = !winnerId && i === 0 && v > 0;
          const didVote = voted[tab] === p.id; const lockedOut = voted[tab] && !didVote;
          return (
            <Card key={p.id} style={{ overflow: "hidden", outline: isWinner ? `1.5px solid ${C.gold}` : leader ? `1.5px solid ${C.gold}66` : "none" }}>
              <div className="relative"><Look k={p.cat} label="" h={150} beforeAfter />
                {(leader || isWinner) && <div className="absolute flex items-center" style={{ gap: 5, left: 10, bottom: 10, padding: "5px 11px", borderRadius: 999, background: "rgba(11,11,14,0.7)", border: `1px solid ${C.gold}66` }}><Crown size={13} style={{ color: C.gold }} /> <span style={{ fontSize: 11.5, fontWeight: 700, color: C.gold }}>{isWinner ? "Winner" : "Leading"}</span></div>}
              </div>
              <div style={{ padding: 14 }}>
                <div className="flex items-center" style={{ gap: 10 }}><Avatar name={p.name} color={c.color} size={36} /><div><div className="flex items-center" style={{ gap: 5, fontWeight: 700, fontSize: 14.5 }}>{p.name} {p.verified && <BadgeCheck size={14} style={{ color: C.gold }} />}</div><div style={{ color: C.sub, fontSize: 12 }}>{p.handle}</div></div></div>
                <div className="flex items-center justify-between" style={{ marginTop: 13 }}>
                  <span style={{ fontSize: 13, color: C.sub }}><b style={{ color: C.text }}>{v.toLocaleString()}</b> votes</span>
                  <button onClick={() => !voted[tab] && vote(tab, p.id)} disabled={!!voted[tab]} className="font-semibold inline-flex items-center" style={{ gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 13, cursor: voted[tab] ? "default" : "pointer", background: didVote ? `${C.gold}26` : lockedOut ? "rgba(255,255,255,0.04)" : C.goldGrad, color: didVote ? C.gold : lockedOut ? C.sub : "#0B0B0E", border: `1px solid ${didVote ? C.gold + "66" : lockedOut ? C.line : "transparent"}` }}>{didVote ? <><Check size={14} /> Voted</> : <><Crown size={14} /> Vote</>}</button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Card style={{ padding: 16, marginTop: 20 }}>
        <SectionTitle icon={Award}>How winners are scored</SectionTitle>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          {[["Public votes", "50%"], ["Verified client votes", "20%"], ["Performance score", "20%"], ["Judge review", "10%"]].map(([k, v]) => <div key={k} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}` }}><div style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 600, color: C.gold }}>{v}</div><div style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>{k}</div></div>)}
        </div>
      </Card>
    </div>
  );
}

/* -------------------------- membership manager ---------------------------- */
const tcInput = { width: "100%", padding: "10px 12px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.line}`, color: C.text, fontSize: 14, outline: "none", fontFamily: "'Hanken Grotesk',sans-serif" };

function TierCard({ proId, tier, idx, count, updateTier, deleteTier }) {
  const [newPerk, setNewPerk] = useState("");
  const set = (patch) => updateTier(proId, tier.id, patch);
  const addPerk = () => { if (!newPerk.trim()) return; set({ perks: [...tier.perks, newPerk.trim()] }); setNewPerk(""); };
  const removePerk = (i) => set({ perks: tier.perks.filter((_, x) => x !== i) });
  return (
    <Card style={{ padding: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span className="inline-flex items-center font-semibold" style={{ gap: 6, fontSize: 12, color: C.gold, padding: "4px 10px", borderRadius: 999, background: `${C.gold}14`, border: `1px solid ${C.gold}40` }}><Crown size={12} /> {count} active · ${tier.price * count}/mo</span>
        <button onClick={() => deleteTier(proId, tier.id)} className="flex items-center" style={{ gap: 5, fontSize: 12.5, color: "#FF6FA5", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} /> Delete</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 10 }}>
        <label><span style={{ display: "block", color: C.sub, fontSize: 12, marginBottom: 5 }}>Tier name</span><input value={tier.name} onChange={(e) => set({ name: e.target.value })} style={tcInput} /></label>
        <label><span style={{ display: "block", color: C.sub, fontSize: 12, marginBottom: 5 }}>Price / month</span>
          <div className="flex items-center" style={{ ...tcInput, padding: 0, paddingLeft: 12 }}><span style={{ color: C.sub }}>$</span><input type="number" min="0" value={tier.price} onChange={(e) => set({ price: parseInt(e.target.value || "0", 10) })} style={{ ...tcInput, border: "none", background: "transparent", paddingLeft: 4 }} /></div>
        </label>
      </div>
      <label style={{ display: "block", marginTop: 10 }}><span style={{ display: "block", color: C.sub, fontSize: 12, marginBottom: 5 }}>What's included</span><input value={tier.includes} onChange={(e) => set({ includes: e.target.value })} placeholder="e.g. 2 cuts / month" style={tcInput} /></label>
      <div style={{ marginTop: 12 }}>
        <span style={{ display: "block", color: C.sub, fontSize: 12, marginBottom: 7 }}>Perks</span>
        <div className="flex flex-wrap" style={{ gap: 7, marginBottom: 8 }}>
          {tier.perks.map((p, i) => (
            <span key={i} className="inline-flex items-center" style={{ gap: 6, fontSize: 12.5, padding: "5px 8px 5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}` }}>{p}<button onClick={() => removePerk(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, display: "flex" }}><X size={13} /></button></span>
          ))}
          {tier.perks.length === 0 && <span style={{ color: C.sub, fontSize: 12.5 }}>No perks yet.</span>}
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <input value={newPerk} onChange={(e) => setNewPerk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerk()} placeholder="Add a perk…" style={{ ...tcInput, flex: 1 }} />
          <button onClick={addPerk} className="font-semibold inline-flex items-center" style={{ gap: 5, padding: "0 14px", borderRadius: 10, fontSize: 13, color: C.gold, background: `${C.gold}14`, border: `1px solid ${C.gold}40`, cursor: "pointer" }}><Plus size={14} /> Add</button>
        </div>
      </div>
    </Card>
  );
}

function MembershipManager({ proId, tiers, addTier, updateTier, deleteTier }) {
  const COUNTS = [26, 11, 6, 4];
  const counts = tiers.map((_, i) => COUNTS[i] != null ? COUNTS[i] : 3);
  const members = counts.reduce((a, b) => a + b, 0);
  const mrr = tiers.reduce((s, t, i) => s + (t.price || 0) * counts[i], 0);
  const preview = tiers.length ? [...tiers].sort((a, b) => a.price - b.price)[0] : null;
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "26px 22px 48px" }}>
      <div className="flex items-center" style={{ gap: 10 }}><Gem size={24} style={{ color: C.gold }} /><H2>Memberships</H2></div>
      <p style={{ color: C.sub, fontSize: 14, margin: "6px 0 20px" }}>Create recurring tiers your clients can subscribe to. These show up automatically as an upgrade option at checkout.</p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 22 }}>
        {[ { icon: Users, label: "Active members", value: members, color: C.gold },
           { icon: Repeat, label: "Monthly recurring", value: `$${mrr.toLocaleString()}`, color: "#34D399" },
           { icon: TrendingUp, label: "12-mo value", value: `$${(mrr * 12).toLocaleString()}`, color: "#56C2FF" } ].map((s) => { const Icon = s.icon; return (
          <Card key={s.label} style={{ padding: 16 }}><Icon size={18} style={{ color: s.color }} /><div style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 600, marginTop: 8 }}>{s.value}</div><div style={{ color: C.sub, fontSize: 12.5 }}>{s.label}</div></Card>); })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", gap: 22, alignItems: "start" }}>
        <div>
          <SectionTitle icon={Crown}>Your tiers</SectionTitle>
          <div className="flex flex-col" style={{ gap: 14 }}>
            {tiers.map((t, i) => <TierCard key={t.id} proId={proId} tier={t} idx={i} count={counts[i]} updateTier={updateTier} deleteTier={deleteTier} />)}
            {tiers.length === 0 && <Card style={{ padding: 26, textAlign: "center", color: C.sub }}>No tiers yet — add your first below.</Card>}
          </div>
          <button onClick={() => addTier(proId)} className="flex items-center justify-center font-semibold" style={{ width: "100%", gap: 8, padding: "13px 0", marginTop: 14, borderRadius: 13, cursor: "pointer", color: C.gold, background: "transparent", border: `1px dashed ${C.gold}55`, fontSize: 14 }}><Plus size={17} /> Add a membership tier</button>
        </div>

        <div>
          <SectionTitle icon={Eye}>Client preview</SectionTitle>
          <p style={{ color: C.sub, fontSize: 12.5, margin: "-4px 0 12px" }}>How your entry tier appears at checkout.</p>
          {preview ? (
            <Card style={{ padding: 4, border: `1px solid ${C.gold}40`, overflow: "hidden" }}>
              <div style={{ padding: "13px 14px 6px" }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 3 }}><Crown size={16} style={{ color: C.gold }} /><span style={{ fontWeight: 700, fontSize: 14.5 }}>{preview.name || "Untitled tier"}</span></div>
                <div style={{ color: C.sub, fontSize: 12.5 }}>{[preview.includes, ...preview.perks].filter(Boolean).join(" · ") || "Add details to see them here"}</div>
              </div>
              <div style={{ padding: 8 }}>
                <div className="flex items-center justify-between" style={{ padding: "11px 12px", borderRadius: 11, background: `${C.gold}12`, border: `1px solid ${C.gold}66` }}>
                  <span className="flex items-center" style={{ gap: 9 }}><span className="flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 18, border: `2px solid ${C.gold}` }}><span style={{ width: 8, height: 8, borderRadius: 8, background: C.gold }} /></span><span style={{ fontSize: 13.5, fontWeight: 600 }}>Join {preview.name || "this tier"}</span></span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.gold }}>${preview.price}/mo</span>
                </div>
              </div>
            </Card>
          ) : <Card style={{ padding: 22, textAlign: "center", color: C.sub, fontSize: 13 }}>Add a tier to preview it.</Card>}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- dashboard ---------------------------------- */
function Dashboard({ go, appts, votes, lineupOn, lineupStatus, fire }) {
  const me = proById("p1");
  const revenue = [ { m: "Dec", v: 3120 }, { m: "Jan", v: 3540 }, { m: "Feb", v: 3380 }, { m: "Mar", v: 4210 }, { m: "Apr", v: 4680 }, { m: "May", v: 5240 } ];
  const topSvc = [ { s: "Fade", v: 64 }, { s: "Fade+Beard", v: 41 }, { s: "Line-Up", v: 28 }, { s: "Kids", v: 19 } ];
  const stats = [
    { icon: DollarSign, label: "Revenue (30d)", value: "$5,240", sub: "+12% MoM", color: "#34D399" },
    { icon: Calendar, label: "Appointments", value: "112", sub: "8 today", color: C.gold },
    { icon: Repeat, label: "Rebooking rate", value: "71%", sub: "+4 pts", color: "#56C2FF" },
    { icon: X, label: "No-show losses", value: "$120", sub: "deposits saved $480", color: "#FF6FA5" },
    { icon: Eye, label: "Profile views", value: "2,840", sub: "+320 wk", color: "#A78BFA" },
    { icon: Gem, label: "Members", value: "43", sub: "$3.7k MRR", color: "#F472D0" },
  ];
  const myVotes = (votes.barber && votes.barber.p1) || 0;
  const upcoming = [ { who: "Jordan P.", svc: "Signature Fade", time: "Today · 3:00 PM", paid: true }, { who: "Marcus T.", svc: "Fade + Beard", time: "Today · 4:30 PM", paid: true }, { who: "New client", svc: "Line-Up", time: "Tomorrow · 9:00 AM", paid: false }, ...appts.map((a) => ({ who: a.people || "You (demo)", svc: a.summary || (a.service && a.service.name) || "Booking", time: `${a.date} · ${a.startTime || a.time}`, paid: true })) ];
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 22px 48px" }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 12, marginBottom: 20 }}>
        <div className="flex items-center" style={{ gap: 12 }}><Avatar name={me.name} color={catOf(me.cat).color} size={48} ring /><div><h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 25, fontWeight: 600, margin: 0 }}>Welcome back, Dre</h2><div className="flex items-center" style={{ gap: 8, color: C.sub, fontSize: 13 }}><Crown size={14} style={{ color: C.gold }} /> Barber of the Month · Chicago</div></div></div>
        <div className="flex flex-wrap" style={{ gap: 10 }}><GhostButton onClick={() => go("memberships")}><Gem size={15} /> Memberships</GhostButton><GhostButton onClick={() => go("fillchair")}><Megaphone size={15} /> Fill my chair</GhostButton><GhostButton onClick={() => go("profile")}>My profile <ChevronRight size={15} /></GhostButton></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12 }}>
        {stats.map((s) => { const Icon = s.icon; return (
          <Card key={s.label} style={{ padding: 16 }}>
            <div className="flex items-center justify-between"><Icon size={18} style={{ color: s.color }} /><span style={{ fontSize: 11.5, color: s.color, fontWeight: 600 }}>{s.sub}</span></div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 27, fontWeight: 600, marginTop: 10 }}>{s.value}</div><div style={{ color: C.sub, fontSize: 12.5 }}>{s.label}</div>
          </Card>); })}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        <Card style={{ padding: 18 }}>
          <SectionTitle icon={TrendingUp}>Revenue trend</SectionTitle>
          <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={revenue} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.gold} stopOpacity={0.5} /><stop offset="100%" stopColor={C.gold} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="m" tick={{ fill: C.sub, fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: C.sub, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, color: C.text }} /><Area type="monotone" dataKey="v" stroke={C.gold} strokeWidth={2.5} fill="url(#g)" /></AreaChart></ResponsiveContainer></div>
        </Card>
        <Card style={{ padding: 18 }}>
          <SectionTitle icon={Scissors}>Top services</SectionTitle>
          <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={topSvc} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="s" tick={{ fill: C.sub, fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: C.sub, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, color: C.text }} /><Bar dataKey="v" radius={[6, 6, 0, 0]} fill={C.gold} /></BarChart></ResponsiveContainer></div>
        </Card>
      </div>

      {/* awards standing */}
      <Card style={{ padding: 18, marginTop: 16, position: "relative", overflow: "hidden" }}>
        <div className="absolute" style={{ inset: 0, background: `radial-gradient(circle at 95% 0%, ${C.gold}1F, transparent 55%)` }} />
        <div className="relative flex items-center justify-between flex-wrap" style={{ gap: 14 }}>
          <div className="flex items-center" style={{ gap: 14 }}>
            <div className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, background: `${C.gold}1A`, border: `1px solid ${C.gold}40` }}><Crown size={22} style={{ color: C.gold }} /></div>
            <div><div style={{ fontWeight: 700, fontSize: 15 }}>Barber of the Month — currently #1</div><div style={{ color: C.sub, fontSize: 13 }}>{myVotes.toLocaleString()} votes · voting closes in 6 days</div></div>
          </div>
          <GhostButton onClick={() => go("profile")}>Update entry <ChevronRight size={15} /></GhostButton>
        </div>
      </Card>

      {lineupOn && (
        <Card style={{ padding: 18, marginTop: 16, position: "relative", overflow: "hidden", border: `1px solid ${C.gold}40` }}>
          <div className="absolute" style={{ inset: 0, background: `radial-gradient(circle at 95% 0%, ${C.gold}26, transparent 55%)` }} />
          <div className="relative flex items-center justify-between flex-wrap" style={{ gap: 14 }}>
            <div className="flex items-center" style={{ gap: 14 }}>
              <div className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, background: `${C.gold}1A`, border: `1px solid ${C.gold}40` }}><Swords size={22} style={{ color: C.gold }} /></div>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>You're in The Lineup · Seed #2</div><div style={{ color: C.sub, fontSize: 13 }}>Chicago Pilot 2026 — {lineupStatus} · semifinal bookings surging</div></div>
            </div>
            <GhostButton onClick={() => fire("Opening your contestant profile…", "check")}>Contestant profile <ChevronRight size={15} /></GhostButton>
          </div>
        </Card>
      )}

      <SectionTitle icon={Calendar} top={22}>Upcoming appointments</SectionTitle>
      <Card style={{ overflow: "hidden" }}>{upcoming.map((u, i) => (
        <div key={i} className="flex items-center justify-between" style={{ padding: "14px 16px", borderTop: i ? `1px solid ${C.lineSoft}` : "none" }}>
          <div className="flex items-center" style={{ gap: 12 }}><div className="flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}` }}><Clock size={16} style={{ color: C.gold }} /></div><div><div style={{ fontWeight: 600, fontSize: 14.5 }}>{u.svc}</div><div style={{ color: C.sub, fontSize: 12.5 }}>{u.who} · {u.time}</div></div></div>
          <span className="font-semibold" style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 999, color: u.paid ? "#34D399" : C.gold, background: u.paid ? "#34D39918" : `${C.gold}14`, border: `1px solid ${u.paid ? "#34D39940" : C.gold + "40"}` }}>{u.paid ? "Deposit paid" : "Deposit pending"}</span>
        </div>))}</Card>
    </div>
  );
}

/* -------------------------------- admin ----------------------------------- */
function BroadcastComposer({ broadcasts, send }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("Everyone");
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(true);
  const [when, setWhen] = useState("Send now");
  const reach = { "All pros": 8, "All clients": 1840, "Everyone": 1848 };
  const canSend = title.trim() && body.trim() && (inApp || email);
  const Toggle = ({ on, onClick, label, icon: Icon }) => (
    <button onClick={onClick} className="flex items-center justify-between" style={{ flex: 1, padding: "10px 13px", borderRadius: 11, cursor: "pointer", background: on ? `${C.gold}12` : "rgba(255,255,255,0.03)", border: `1px solid ${on ? C.gold + "66" : C.line}` }}>
      <span className="flex items-center" style={{ gap: 7, fontSize: 13.5, fontWeight: 600 }}><Icon size={14} style={{ color: on ? C.gold : C.sub }} /> {label}</span>
      <span className="flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 6, background: on ? C.goldGrad : "transparent", border: `1px solid ${on ? "transparent" : C.line}` }}>{on && <Check size={12} style={{ color: "#1A1306" }} />}</span>
    </button>
  );
  const submit = () => { if (!canSend) return; send({ title: title.trim(), body: body.trim(), audience, inApp, email, scheduled: when !== "Send now", when }); setTitle(""); setBody(""); };
  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start" }}>
      <Card style={{ padding: 18 }}>
        <SectionTitle icon={Send}>Compose announcement</SectionTitle>
        <label><span style={{ display: "block", color: C.sub, fontSize: 12.5, marginBottom: 6 }}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New: book group appointments"
            style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: C.surface2, border: `1px solid ${C.line}`, color: C.text, fontSize: 14, outline: "none", fontFamily: "'Hanken Grotesk',sans-serif" }} /></label>
        <div style={{ height: 12 }} />
        <label><span style={{ display: "block", color: C.sub, fontSize: 12.5, marginBottom: 6 }}>Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="What do you want them to know?"
            style={{ width: "100%", padding: 12, borderRadius: 11, background: C.surface2, border: `1px solid ${C.line}`, color: C.text, fontSize: 14, outline: "none", resize: "vertical", fontFamily: "'Hanken Grotesk',sans-serif" }} /></label>
        <div style={{ height: 12 }} />
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label="Audience" value={audience} onChange={setAudience} options={["All pros", "All clients", "Everyone"]} />
          <Select label="When" value={when} onChange={setWhen} options={["Send now", "Tomorrow 9:00 AM", "This weekend"]} />
        </div>
        <div style={{ color: C.sub, fontSize: 12.5, margin: "8px 0 12px" }}>Reaches <b style={{ color: C.gold }}>{reach[audience].toLocaleString()}</b> people</div>
        <span style={{ display: "block", color: C.sub, fontSize: 12.5, marginBottom: 6 }}>Channels</span>
        <div className="flex" style={{ gap: 10, marginBottom: 16 }}>
          <Toggle on={inApp} onClick={() => setInApp((v) => !v)} label="In-app" icon={Bell} />
          <Toggle on={email} onClick={() => setEmail((v) => !v)} label="Email" icon={Mail} />
        </div>
        <GoldButton full disabled={!canSend} onClick={submit}>{when === "Send now" ? "Send announcement" : "Schedule announcement"} <Send size={15} /></GoldButton>
      </Card>

      <div>
        <SectionTitle icon={TrendingUp}>Recent broadcasts</SectionTitle>
        {broadcasts.length === 0 && <Card style={{ padding: 24, textAlign: "center", color: C.sub }}>No announcements sent yet.</Card>}
        <div className="flex flex-col" style={{ gap: 12 }}>
          {broadcasts.map((b) => (
            <Card key={b.id} style={{ padding: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{b.title}</span>
                {b.scheduled ? <span className="font-semibold" style={{ fontSize: 11, color: "#56C2FF" }}>Scheduled</span> : <span className="font-semibold" style={{ fontSize: 11, color: "#34D399" }}>Sent</span>}
              </div>
              <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.5 }}>{b.body}</div>
              <div className="flex items-center flex-wrap" style={{ gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 11.5, color: C.sub, padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}` }}>{b.audience}</span>
                {b.inApp && <span className="inline-flex items-center" style={{ gap: 4, fontSize: 11.5, color: C.sub }}><Bell size={11} /> in-app</span>}
                {b.email && <span className="inline-flex items-center" style={{ gap: 4, fontSize: 11.5, color: C.sub }}><Mail size={11} /> email</span>}
              </div>
              {!b.scheduled && (
                <div className="flex items-center justify-between" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}`, fontSize: 12.5 }}>
                  <span style={{ color: C.sub }}>{b.recipients.toLocaleString()} sent</span>
                  <span style={{ color: C.sub }}><b style={{ color: C.text }}>{b.delivered.toLocaleString()}</b> delivered</span>
                  <span style={{ color: C.sub }}><b style={{ color: "#34D399" }}>{b.openRate}%</b> opened</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Admin({ subs, setSubs, reports, setReports, flagVotes, setFlagVotes, winners, setWinners, catActive, setCatActive, marketplaceOn, setMarketplaceOn, prodAvail, toggleProd, lineupOn, setLineupOn, lineupStatus, setLineupStatus, broadcasts, sendBroadcast, fire }) {
  const [sub, setSub] = useState("overview");
  const pendingSubs = subs.filter((s) => s.status === "pending" || s.status === "flagged");
  const tabs = [ { k: "overview", label: "Overview", icon: Shield }, { k: "broadcast", label: "Broadcast", icon: Send }, { k: "subs", label: "Submissions", icon: ImageIcon, n: pendingSubs.length }, { k: "reports", label: "Reports", icon: Flag, n: reports.length }, { k: "votes", label: "Vote integrity", icon: ShieldCheck, n: flagVotes.length }, { k: "winners", label: "Winners & categories", icon: Trophy }, { k: "market", label: "Marketplace", icon: ShoppingBag }, { k: "lineup", label: "The Lineup", icon: Swords } ];
  const LINEUP_PHASES = ["Qualifying", "Quarterfinals Live", "Semifinals Live", "Final Live", "Champion Crowned"];

  const approveSub = (id) => { setSubs((s) => s.map((x) => x.id === id ? { ...x, status: "approved" } : x)); fire("Entry approved", "check"); };
  const removeSub = (id) => { setSubs((s) => s.map((x) => x.id === id ? { ...x, status: "removed" } : x)); fire("Entry removed from contest", "ban"); };
  const resolveReport = (id, action) => { setReports((r) => r.filter((x) => x.id !== id)); fire(action === "remove" ? "Content removed & user warned" : "Report dismissed", action === "remove" ? "ban" : "check"); };
  const voidVotes = (id) => { setFlagVotes((v) => v.filter((x) => x.id !== id)); fire("Flagged votes voided", "ban"); };
  const keepVotes = (id) => { setFlagVotes((v) => v.filter((x) => x.id !== id)); fire("Votes cleared as legitimate", "check"); };
  const pickWinner = (cat, proId) => { setWinners((w) => ({ ...w, [cat]: proId })); fire(`${proById(proId) ? first(proById(proId).name) : ""} crowned ${catOf(cat).label} of the Month`, "crown"); };

  const sevColor = (s) => s === "High" ? "#FF6FA5" : s === "Med" ? "#F4A93C" : "#56C2FF";
  const statusPill = (st) => {
    const map = { approved: ["#34D399", "Approved"], removed: ["#FF6FA5", "Removed"], flagged: ["#F4A93C", "Flagged"], pending: [C.sub, "Pending"] };
    const [col, label] = map[st]; return <span className="font-semibold" style={{ fontSize: 11.5, color: col }}>{label}</span>;
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "26px 22px 48px" }}>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 4 }}><Shield size={24} style={{ color: C.gold }} /><h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 600, margin: 0 }}>Moderation console</h2></div>
      <p style={{ color: C.sub, fontSize: 14, margin: "6px 0 18px" }}>Review submissions, handle reports, protect vote integrity, and crown winners.</p>

      <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 22 }}>
        {tabs.map((t) => { const Icon = t.icon; const on = sub === t.k; return (
          <button key={t.k} onClick={() => setSub(t.k)} className="font-semibold inline-flex items-center" style={{ gap: 7, padding: "9px 14px", borderRadius: 11, fontSize: 13.5, cursor: "pointer", color: on ? "#0B0B0E" : C.text, background: on ? C.goldGrad : "rgba(255,255,255,0.04)", border: `1px solid ${on ? "transparent" : C.line}` }}>
            <Icon size={15} /> {t.label}{t.n ? <span style={{ marginLeft: 2, fontSize: 11.5, padding: "1px 7px", borderRadius: 999, background: on ? "rgba(0,0,0,0.18)" : `${C.gold}26`, color: on ? "#1A1306" : C.gold }}>{t.n}</span> : null}
          </button>); })}
      </div>

      {sub === "broadcast" && <BroadcastComposer broadcasts={broadcasts} send={sendBroadcast} />}

      {sub === "overview" && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          {[ { icon: ImageIcon, label: "Submissions to review", value: pendingSubs.length, color: C.gold },
             { icon: Flag, label: "Open reports", value: reports.length, color: "#FF6FA5" },
             { icon: ShieldCheck, label: "Vote anomalies", value: flagVotes.length, color: "#F4A93C" },
             { icon: Crown, label: "Winners selected", value: `${Object.keys(winners).length}/${CATS.length}`, color: "#34D399" },
             { icon: Users, label: "Active pros", value: PROS.length, color: "#56C2FF" },
             { icon: Trophy, label: "Live categories", value: Object.values(catActive).filter(Boolean).length, color: "#A78BFA" },
             { icon: ShoppingBag, label: "Marketplace", value: marketplaceOn ? "Live" : "Hidden", color: marketplaceOn ? "#34D399" : C.sub } ].map((s) => { const Icon = s.icon; return (
            <Card key={s.label} style={{ padding: 18 }}><div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 11, marginBottom: 12, background: `${s.color}1A`, border: `1px solid ${s.color}40` }}><Icon size={19} style={{ color: s.color }} /></div><div style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 600 }}>{s.value}</div><div style={{ color: C.sub, fontSize: 13 }}>{s.label}</div></Card>); })}
        </div>
      )}

      {sub === "subs" && (
        <div className="flex flex-col" style={{ gap: 12 }}>
          {subs.map((s) => { const pro = proById(s.proId); const c = catOf(s.cat); const open = s.status === "pending" || s.status === "flagged"; return (
            <Card key={s.id} style={{ padding: 14, opacity: open ? 1 : 0.6 }}>
              <div className="flex items-center" style={{ gap: 14 }}>
                <div style={{ width: 96, flexShrink: 0 }}><Look k={s.cat} label="" h={72} beforeAfter /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center" style={{ gap: 8 }}><Avatar name={pro.name} color={c.color} size={28} /><span style={{ fontWeight: 700, fontSize: 14 }}>{pro.name}</span><CatBadge k={s.cat} small /></div>
                    {statusPill(s.status)}
                  </div>
                  <div style={{ fontSize: 13.5, marginTop: 6 }}>Entry: <b>{s.look}</b> · {catOf(s.cat).label} of the Month</div>
                  {s.flag && <div className="flex items-center" style={{ gap: 6, marginTop: 6, color: "#F4A93C", fontSize: 12.5 }}><AlertTriangle size={13} /> {s.flag}</div>}
                </div>
                {open && (
                  <div className="flex" style={{ gap: 8 }}>
                    <button onClick={() => approveSub(s.id)} className="font-semibold inline-flex items-center" style={{ gap: 5, padding: "8px 12px", borderRadius: 10, fontSize: 12.5, color: "#34D399", background: "#34D39914", border: "1px solid #34D39940", cursor: "pointer" }}><Check size={13} /> Approve</button>
                    <button onClick={() => removeSub(s.id)} className="font-semibold inline-flex items-center" style={{ gap: 5, padding: "8px 12px", borderRadius: 10, fontSize: 12.5, color: "#FF6FA5", background: "#FF6FA514", border: "1px solid #FF6FA540", cursor: "pointer" }}><Trash2 size={13} /> Remove</button>
                  </div>
                )}
              </div>
            </Card>); })}
        </div>
      )}

      {sub === "reports" && (
        <div className="flex flex-col" style={{ gap: 12 }}>
          {reports.length === 0 && <Card style={{ padding: 28, textAlign: "center", color: C.sub }}><CheckCircle2 size={24} style={{ color: "#34D399", marginBottom: 8 }} /><div>Queue clear — no open reports.</div></Card>}
          {reports.map((r) => (
            <Card key={r.id} style={{ padding: 16 }}>
              <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
                <div>
                  <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}><Flag size={14} style={{ color: sevColor(r.sev) }} /><span style={{ fontWeight: 700, fontSize: 14 }}>{r.kind}</span><span style={{ fontSize: 11.5, fontWeight: 600, color: sevColor(r.sev) }}>{r.sev} severity</span></div>
                  <div style={{ color: C.sub, fontSize: 13 }}>{r.who} · {r.reason}</div>
                </div>
                <div className="flex" style={{ gap: 8 }}>
                  <button onClick={() => resolveReport(r.id, "dismiss")} className="font-semibold" style={{ padding: "8px 12px", borderRadius: 10, fontSize: 12.5, color: C.text, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, cursor: "pointer" }}>Dismiss</button>
                  <button onClick={() => resolveReport(r.id, "remove")} className="font-semibold inline-flex items-center" style={{ gap: 5, padding: "8px 12px", borderRadius: 10, fontSize: 12.5, color: "#FF6FA5", background: "#FF6FA514", border: "1px solid #FF6FA540", cursor: "pointer" }}><Ban size={13} /> Remove & warn</button>
                </div>
              </div>
            </Card>))}
        </div>
      )}

      {sub === "votes" && (
        <div className="flex flex-col" style={{ gap: 12 }}>
          <Card style={{ padding: 14, background: "rgba(244,169,60,0.06)", border: "1px solid rgba(244,169,60,0.3)" }}>
            <div className="flex items-center" style={{ gap: 8, color: "#F4A93C", fontSize: 13 }}><ShieldCheck size={15} /> Automated fraud controls flag bursts, duplicate devices, and new-account clusters for human review.</div>
          </Card>
          {flagVotes.length === 0 && <Card style={{ padding: 28, textAlign: "center", color: C.sub }}><CheckCircle2 size={24} style={{ color: "#34D399", marginBottom: 8 }} /><div>No anomalies pending.</div></Card>}
          {flagVotes.map((f) => { const pro = proById(f.proId); return (
            <Card key={f.id} style={{ padding: 16 }}>
              <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
                <div>
                  <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}><AlertTriangle size={14} style={{ color: "#F4A93C" }} /><span style={{ fontWeight: 700, fontSize: 14 }}>{pro.name}</span><CatBadge k={f.cat} small /></div>
                  <div style={{ color: C.sub, fontSize: 13 }}>{f.note} · <b style={{ color: C.text }}>{f.count}</b> votes in question</div>
                </div>
                <div className="flex" style={{ gap: 8 }}>
                  <button onClick={() => keepVotes(f.id)} className="font-semibold" style={{ padding: "8px 12px", borderRadius: 10, fontSize: 12.5, color: "#34D399", background: "#34D39914", border: "1px solid #34D39940", cursor: "pointer" }}>Legitimate</button>
                  <button onClick={() => voidVotes(f.id)} className="font-semibold inline-flex items-center" style={{ gap: 5, padding: "8px 12px", borderRadius: 10, fontSize: 12.5, color: "#FF6FA5", background: "#FF6FA514", border: "1px solid #FF6FA540", cursor: "pointer" }}><Ban size={13} /> Void votes</button>
                </div>
              </div>
            </Card>); })}
        </div>
      )}

      {sub === "winners" && (<>
        <SectionTitle icon={Crown}>Select winners</SectionTitle>
        <div className="flex flex-col" style={{ gap: 12 }}>
          {CATS.filter((c) => catActive[c.key]).map((c) => { const entries = PROS.filter((p) => p.cat === c.key); const winnerId = winners[c.key]; return (
            <Card key={c.key} style={{ padding: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}><CatBadge k={c.key} />{winnerId && <span className="inline-flex items-center font-semibold" style={{ gap: 5, fontSize: 12, color: C.gold }}><Crown size={13} /> {proById(winnerId).name}</span>}</div>
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                {entries.map((p) => { const won = winnerId === p.id; return (
                  <button key={p.id} onClick={() => pickWinner(c.key, p.id)} className="font-semibold inline-flex items-center" style={{ gap: 7, padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", color: won ? "#0B0B0E" : C.text, background: won ? C.goldGrad : "rgba(255,255,255,0.04)", border: `1px solid ${won ? "transparent" : C.line}` }}>
                    {won && <Crown size={13} />} {p.name}
                  </button>); })}
              </div>
            </Card>); })}
        </div>
        <SectionTitle icon={Settings} top={24}>Category management</SectionTitle>
        <Card style={{ overflow: "hidden" }}>
          {CATS.map((c, i) => { const Icon = c.icon; const on = catActive[c.key]; return (
            <div key={c.key} className="flex items-center justify-between" style={{ padding: "13px 16px", borderTop: i ? `1px solid ${C.lineSoft}` : "none" }}>
              <span className="flex items-center" style={{ gap: 9, fontSize: 14, fontWeight: 600 }}><Icon size={16} style={{ color: c.color }} /> {c.label} of the Month</span>
              <button onClick={() => setCatActive((s) => ({ ...s, [c.key]: !s[c.key] }))} style={{ width: 44, height: 25, borderRadius: 999, position: "relative", cursor: "pointer", border: "none", background: on ? C.gold : "rgba(255,255,255,0.12)", transition: "background .2s" }}>
                <span style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 19, height: 19, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
              </button>
            </div>); })}
        </Card>
      </>)}

      {sub === "market" && (<>
        <Card style={{ padding: 18, marginBottom: 18, position: "relative", overflow: "hidden", border: `1px solid ${marketplaceOn ? "#34D39955" : C.line}` }}>
          <div className="absolute" style={{ inset: 0, background: `radial-gradient(circle at 95% 0%, ${marketplaceOn ? "#34D399" : C.gold}1F, transparent 55%)` }} />
          <div className="relative flex items-center justify-between flex-wrap" style={{ gap: 14 }}>
            <div className="flex items-center" style={{ gap: 14 }}>
              <div className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, background: marketplaceOn ? "#34D39914" : "rgba(255,255,255,0.05)", border: `1px solid ${marketplaceOn ? "#34D39940" : C.line}` }}><Power size={22} style={{ color: marketplaceOn ? "#34D399" : C.sub }} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Self-care marketplace is {marketplaceOn ? "live" : "hidden"}</div>
                <div style={{ color: C.sub, fontSize: 13, maxWidth: 420 }}>{marketplaceOn ? "Clients can browse and buy products, and shop what their pro used." : "Hidden from clients entirely. Flip this on when you're ready to start selling."}</div>
              </div>
            </div>
            <button onClick={() => setMarketplaceOn((v) => { fire(v ? "Marketplace hidden" : "Marketplace is now live", v ? "ban" : "check"); return !v; })} style={{ width: 56, height: 31, borderRadius: 999, position: "relative", cursor: "pointer", border: "none", background: marketplaceOn ? "#34D399" : "rgba(255,255,255,0.14)", transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 3, left: marketplaceOn ? 28 : 3, width: 25, height: 25, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
            </button>
          </div>
        </Card>
        <SectionTitle icon={Package}>Product catalog</SectionTitle>
        <Card style={{ overflow: "hidden" }}>
          {PRODUCTS.map((p, i) => { const on = prodAvail[p.id]; return (
            <div key={p.id} className="flex items-center justify-between" style={{ padding: "12px 16px", borderTop: i ? `1px solid ${C.lineSoft}` : "none", opacity: on ? 1 : 0.55 }}>
              <div className="flex items-center" style={{ gap: 12 }}>
                <div style={{ width: 44, flexShrink: 0 }}><ProductTile cat={p.cat} h={44} /></div>
                <div><div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div><div style={{ color: C.sub, fontSize: 12 }}>{p.brand} · ${p.price} · {prodCatOf(p.cat).label}</div></div>
              </div>
              <div className="flex items-center" style={{ gap: 12 }}>
                <span style={{ fontSize: 12, color: on ? "#34D399" : C.sub, fontWeight: 600 }}>{on ? "In stock" : "Hidden"}</span>
                <button onClick={() => toggleProd(p.id)} style={{ width: 40, height: 23, borderRadius: 999, position: "relative", cursor: "pointer", border: "none", background: on ? C.gold : "rgba(255,255,255,0.12)", transition: "background .2s" }}>
                  <span style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
                </button>
              </div>
            </div>); })}
        </Card>
        <p style={{ color: C.sub, fontSize: 11.5, marginTop: 14, opacity: 0.7 }}>First-party catalog. Inventory, fulfillment &amp; tax are simulated — real retail operations are the Batch 10 backend.</p>
      </>)}

      {sub === "lineup" && (<>
        <Card style={{ padding: 18, marginBottom: 18, position: "relative", overflow: "hidden", border: `1px solid ${lineupOn ? "#34D39955" : C.line}` }}>
          <div className="absolute" style={{ inset: 0, background: `radial-gradient(circle at 95% 0%, ${lineupOn ? "#34D399" : C.gold}1F, transparent 55%)` }} />
          <div className="relative flex items-center justify-between flex-wrap" style={{ gap: 14 }}>
            <div className="flex items-center" style={{ gap: 14 }}>
              <div className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, background: lineupOn ? "#34D39914" : "rgba(255,255,255,0.05)", border: `1px solid ${lineupOn ? "#34D39940" : C.line}` }}><Power size={22} style={{ color: lineupOn ? "#34D399" : C.sub }} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>The Lineup is {lineupOn ? "live" : "hidden"}</div>
                <div style={{ color: C.sub, fontSize: 13, maxWidth: 440 }}>{lineupOn ? "Fans can browse the bracket, vote the wildcard, and book contestants from their storefronts." : "The championship layer is hidden from everyone. Flip on when you're ready to launch a season."}</div>
              </div>
            </div>
            <button onClick={() => setLineupOn((v) => { fire(v ? "The Lineup hidden" : "The Lineup is now live", v ? "ban" : "check"); return !v; })} style={{ width: 56, height: 31, borderRadius: 999, position: "relative", cursor: "pointer", border: "none", background: lineupOn ? "#34D399" : "rgba(255,255,255,0.14)", transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 3, left: lineupOn ? 28 : 3, width: 25, height: 25, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
            </button>
          </div>
        </Card>

        <SectionTitle icon={Swords}>Season &amp; bracket</SectionTitle>
        <Card style={{ padding: 16, marginBottom: 18 }}>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: 12, marginBottom: 14 }}>
            <div><div style={{ fontWeight: 700, fontSize: 14.5 }}>Chicago Pilot · 2026</div><div style={{ color: C.sub, fontSize: 12.5 }}>8 contestants seeded from top-ranked pros · current phase below</div></div>
            <span className="inline-flex items-center font-semibold" style={{ gap: 6, fontSize: 12, color: C.gold, padding: "5px 11px", borderRadius: 999, background: `${C.gold}14`, border: `1px solid ${C.gold}40` }}><Swords size={12} /> {lineupStatus}</span>
          </div>
          <div style={{ color: C.sub, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>ADVANCE THE SEASON</div>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {LINEUP_PHASES.map((p) => { const on = lineupStatus === p; return (
              <button key={p} onClick={() => { setLineupStatus(p); fire(`Season set to: ${p}`, "check"); }} className="font-semibold" style={{ padding: "8px 13px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", color: on ? "#0B0B0E" : C.text, background: on ? C.goldGrad : "rgba(255,255,255,0.04)", border: `1px solid ${on ? "transparent" : C.line}` }}>{p}</button>
            ); })}
          </div>
        </Card>

        <SectionTitle icon={ShieldCheck}>Fan-vote integrity</SectionTitle>
        <Card style={{ padding: 16 }}>
          <div className="flex items-center" style={{ gap: 8, color: "#F4A93C", fontSize: 13, marginBottom: 10 }}><ShieldCheck size={15} /> Same integrity layer as Awards — verified accounts, one vote per window, metro weighting, edge rate limits.</div>
          <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.55 }}>Fans decide only the <b style={{ color: C.text }}>Redemption Wildcard</b> and <b style={{ color: C.text }}>Fan Favorite</b>. Expert judges decide every bracket outcome — fan votes never crown the champion.</div>
        </Card>
        <p style={{ color: C.sub, fontSize: 11.5, marginTop: 14, opacity: 0.7 }}>Bracket, judging &amp; ticketing back-end are the phased Lineup build (Phases 0–5). This is the launchable front-end layer.</p>
      </>)}
    </div>
  );
}

/* ------------------------------ marketplace ------------------------------- */
function ProductTile({ cat, h = 140 }) {
  const c = prodCatOf(cat);
  return (
    <div className="relative overflow-hidden" style={{ height: h, borderRadius: 14, border: `1px solid ${C.line}` }}>
      <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${c.color}33, ${C.surface2} 65%), radial-gradient(circle at 72% 22%, ${c.color}30, transparent 55%)` }} />
      <Package size={Math.min(h * 0.4, 56)} strokeWidth={1} className="absolute" style={{ right: -4, bottom: -4, color: c.color, opacity: 0.22 }} />
    </div>
  );
}

function Marketplace({ products, avail, cart, addToCart }) {
  const [active, setActive] = useState("all");
  const list = products.filter((p) => avail[p.id] && (active === "all" || p.cat === active));
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 22px 48px" }}>
      <div className="flex items-center" style={{ gap: 10 }}><ShoppingBag size={24} style={{ color: C.gold }} /><H2>Self-care market</H2></div>
      <p style={{ color: C.sub, fontSize: 14, margin: "6px 0 18px" }}>Curated grooming &amp; beauty products — the same ones trusted by pros on the platform.</p>
      <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 22 }}>
        <Chip label="All" active={active === "all"} onClick={() => setActive("all")} />
        {PROD_CATS.map((c) => <Chip key={c.key} label={c.label} color={c.color} active={active === c.key} onClick={() => setActive(c.key)} />)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
        {list.map((p) => { const inCart = cart[p.id] || 0; const usedBy = p.usedBy && proById(p.usedBy); return (
          <Card key={p.id} style={{ overflow: "hidden" }}>
            <ProductTile cat={p.cat} />
            <div style={{ padding: 14 }}>
              <div style={{ color: C.sub, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.3 }}>{p.brand.toUpperCase()}</div>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 2 }}>{p.name}</div>
              <div style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.5, marginTop: 5, minHeight: 36 }}>{p.blurb}</div>
              {usedBy && <div className="flex items-center" style={{ gap: 5, marginTop: 8, fontSize: 11.5, color: C.gold }}><BadgeCheck size={12} /> Used by {usedBy.name}</div>}
              <div className="flex items-center justify-between" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>${p.price}</span>
                <button onClick={() => addToCart(p.id)} className="font-semibold inline-flex items-center" style={{ gap: 6, padding: "8px 13px", borderRadius: 10, fontSize: 13, cursor: "pointer", color: inCart ? C.gold : "#0B0B0E", background: inCart ? `${C.gold}1A` : C.goldGrad, border: `1px solid ${inCart ? C.gold + "40" : "transparent"}` }}>
                  {inCart ? <><Check size={14} /> In cart ({inCart})</> : <><Plus size={14} /> Add</>}
                </button>
              </div>
            </div>
          </Card>); })}
      </div>
      {list.length === 0 && <div style={{ color: C.sub, textAlign: "center", padding: 50 }}>No products in this category yet.</div>}
      <p style={{ color: C.sub, fontSize: 11.5, textAlign: "center", marginTop: 28, opacity: 0.7 }}>Fulfillment, shipping &amp; tax are simulated in this prototype.</p>
    </div>
  );
}

function CartDrawer({ cart, setQty, removeFromCart, checkout, close }) {
  const items = Object.keys(cart).map((id) => ({ p: productById(id), qty: cart[id] })).filter((x) => x.p);
  const subtotal = items.reduce((s, x) => s + x.p.price * x.qty, 0);
  const shipping = subtotal > 50 || subtotal === 0 ? 0 : 6;
  return (
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: 70, background: "rgba(5,5,7,0.74)", backdropFilter: "blur(3px)" }} onClick={close}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, height: "100%", background: C.bg, borderLeft: `1px solid ${C.line}`, display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: `1px solid ${C.lineSoft}` }}>
          <span className="flex items-center" style={{ gap: 9, fontWeight: 700, fontSize: 16 }}><ShoppingBag size={18} style={{ color: C.gold }} /> Your cart</span>
          <button onClick={close} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
          {items.length === 0 && <div style={{ color: C.sub, textAlign: "center", padding: "60px 0" }}><ShoppingBag size={28} style={{ opacity: 0.5, marginBottom: 10 }} /><div>Your cart is empty.</div></div>}
          <div className="flex flex-col" style={{ gap: 12 }}>
            {items.map(({ p, qty }) => (
              <div key={p.id} className="flex" style={{ gap: 12 }}>
                <div style={{ width: 64, flexShrink: 0 }}><ProductTile cat={p.cat} h={64} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-start justify-between" style={{ gap: 8 }}>
                    <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}</div><div style={{ color: C.sub, fontSize: 11.5 }}>{p.brand}</div></div>
                    <button onClick={() => removeFromCart(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}><Trash2 size={15} /></button>
                  </div>
                  <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                    <div className="flex items-center" style={{ gap: 0, border: `1px solid ${C.line}`, borderRadius: 9, overflow: "hidden" }}>
                      <button onClick={() => setQty(p.id, qty - 1)} className="flex items-center justify-center" style={{ width: 28, height: 28, background: "rgba(255,255,255,0.04)", border: "none", cursor: "pointer", color: C.text }}><Minus size={13} /></button>
                      <span style={{ width: 30, textAlign: "center", fontSize: 13, fontWeight: 700 }}>{qty}</span>
                      <button onClick={() => setQty(p.id, qty + 1)} className="flex items-center justify-center" style={{ width: 28, height: 28, background: "rgba(255,255,255,0.04)", border: "none", cursor: "pointer", color: C.text }}><Plus size={13} /></button>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>${p.price * qty}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {items.length > 0 && (
          <div style={{ padding: 18, borderTop: `1px solid ${C.lineSoft}` }}>
            <div className="flex items-center justify-between" style={{ color: C.sub, fontSize: 13.5, padding: "3px 0" }}><span>Subtotal</span><span style={{ color: C.text }}>${subtotal}</span></div>
            <div className="flex items-center justify-between" style={{ color: C.sub, fontSize: 13.5, padding: "3px 0" }}><span>Shipping</span><span style={{ color: C.text }}>{shipping === 0 ? "Free" : `$${shipping}`}</span></div>
            <div className="flex items-center justify-between" style={{ padding: "8px 0 12px", marginTop: 4, borderTop: `1px solid ${C.lineSoft}` }}><span style={{ fontWeight: 700 }}>Total</span><span style={{ fontWeight: 800, color: C.gold, fontSize: 18 }}>${subtotal + shipping}</span></div>
            <GoldButton full onClick={() => checkout(subtotal + shipping)}>Checkout · ${subtotal + shipping} <ArrowRight size={16} /></GoldButton>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- the lineup ------------------------------- */
const TL_BARBERS = {
  b1: { id: "b1", seed: 1, name: "Marcus Tillman", nick: "Magic", shop: "Fade Lab", hood: "Bronzeville", rating: 5.0, bookings: 1240, sig: "The Architect — razor-structured fades", grad: ["#3a2f10", "#0f0d09"] },
  b2: { id: "b2", seed: 2, name: "Dre Carter", nick: "", shop: "Crowns & Co.", hood: "Hyde Park", rating: 4.9, bookings: 1108, sig: "360 waves & deep enzo patterns", grad: ["#102a30", "#0b0d0e"], proId: "p1" },
  b3: { id: "b3", seed: 3, name: "Trell Dawson", nick: "", shop: "Sharp Society", hood: "Chatham", rating: 4.9, bookings: 980, sig: "Beard sculpting & blended tapers", grad: ["#2b1330", "#0c0a0e"] },
  b4: { id: "b4", seed: 4, name: "Quan Rivers", nick: "", shop: "Linework", hood: "Pilsen", rating: 4.8, bookings: 910, sig: "Freehand hair design & stencil art", grad: ["#301a12", "#0e0a09"] },
  b5: { id: "b5", seed: 5, name: "Lorenzo Banks", nick: "Big Lo", shop: "King's Chair", hood: "Austin", rating: 4.9, bookings: 870, sig: "Old-school precision tapers", grad: ["#2c2710", "#0d0c08"] },
  b6: { id: "b6", seed: 6, name: "Jaylen Brooks", nick: "", shop: "Cut Theory", hood: "South Shore", rating: 4.8, bookings: 845, sig: "Modern textured crops & fringe", grad: ["#10302a", "#090e0d"] },
  b7: { id: "b7", seed: 7, name: "Demarco Hayes", nick: "Smoke", shop: "Bladework", hood: "Englewood", rating: 4.8, bookings: 800, sig: "Straight-razor finishes", grad: ["#1c1c22", "#0a0a0c"] },
  b8: { id: "b8", seed: 8, name: "Khalil Reed", nick: "", shop: "Studio 79", hood: "Woodlawn", rating: 4.8, bookings: 760, sig: "Natural texture, afros & shape-ups", grad: ["#301226", "#0d090c"] },
};
const TL_REDEMPTION = [ { id: "b4", base: 1842 }, { id: "b8", base: 1190 }, { id: "b7", base: 980 }, { id: "b6", base: 640 } ];
const TL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap');
.tl-root{--gold:#d4af37;--gold-bri:#f3d98b;--gold-deep:#9c7c28;--panel:#131316;--panel2:#1a1a20;--line:#26262d;--text:#f5f2ea;--muted:#8b8b94;--live:#e7443b;
  font-family:'Manrope',sans-serif;color:var(--text);max-width:1160px;margin:0 auto;padding:16px 0 40px;position:relative}
.tl-head{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;border-bottom:1px solid var(--line);padding-bottom:20px}
.tl-kicker{font-size:11px;letter-spacing:.32em;color:var(--gold);font-weight:700;text-transform:uppercase}
.tl-word{font-family:'Bebas Neue',sans-serif;font-size:58px;line-height:.86;letter-spacing:.02em;background:linear-gradient(180deg,var(--gold-bri),var(--gold) 55%,var(--gold-deep));-webkit-background-clip:text;background-clip:text;color:transparent;margin-top:2px}
.tl-sub{font-size:13px;color:var(--muted);margin-top:6px;letter-spacing:.04em}
.tl-live{display:inline-flex;align-items:center;gap:8px;background:rgba(231,68,59,.12);border:1px solid rgba(231,68,59,.4);color:#ff7a72;font-weight:700;font-size:12px;letter-spacing:.12em;padding:8px 14px;border-radius:999px;text-transform:uppercase}
.tl-dot{width:8px;height:8px;border-radius:50%;background:var(--live);animation:tlpulse 1.6s infinite}
@keyframes tlpulse{0%{box-shadow:0 0 0 0 rgba(231,68,59,.6)}70%{box-shadow:0 0 0 9px rgba(231,68,59,0)}100%{box-shadow:0 0 0 0 rgba(231,68,59,0)}}
.tl-stats{display:flex;gap:26px;flex-wrap:wrap;margin:22px 0 30px}
.tl-stat b{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:.02em;color:var(--gold-bri);line-height:1;display:block}
.tl-stat span{font-size:11px;letter-spacing:.16em;color:var(--muted);text-transform:uppercase;margin-top:4px;display:block}
.tl-bscroll{overflow-x:auto;padding-bottom:14px}
.tl-bscroll::-webkit-scrollbar{height:8px}.tl-bscroll::-webkit-scrollbar-thumb{background:var(--gold-deep);border-radius:8px}
.tl-bracket{display:flex;min-width:940px;align-items:stretch}
.tl-col{display:flex;flex-direction:column;flex:1}
.tl-conn{display:flex;flex-direction:column;width:46px;flex:0 0 46px}
.tl-head2{height:34px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.14em;color:var(--gold);text-transform:uppercase}
.tl-body{flex:1;display:flex;flex-direction:column;justify-content:space-around;gap:14px;padding:6px 0}
.tl-cbody{flex:1;display:flex;flex-direction:column;justify-content:space-around;padding:6px 0}
.tl-cellpad{height:34px}
.tl-match{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:12px;overflow:hidden;position:relative;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.tl-match.live{border-color:rgba(231,68,59,.55);box-shadow:0 0 0 1px rgba(231,68,59,.25),0 10px 30px rgba(231,68,59,.12)}
.tl-mtag{position:absolute;top:-9px;left:12px;font-size:9px;letter-spacing:.14em;font-weight:800;text-transform:uppercase;padding:3px 8px;border-radius:6px;background:var(--panel2);border:1px solid var(--line);color:var(--muted)}
.tl-mtag.live{background:rgba(231,68,59,.16);border-color:rgba(231,68,59,.5);color:#ff8079}
.tl-row{display:flex;align-items:center;gap:10px;padding:9px 11px;cursor:pointer;transition:background .15s}
.tl-row+.tl-row{border-top:1px solid var(--line)}
.tl-row:hover{background:rgba(212,175,55,.08)}
.tl-row.win{background:rgba(212,175,55,.07)}
.tl-row.win .tl-rname{color:var(--gold-bri)}
.tl-seed{font-size:10px;color:var(--muted);width:16px;font-weight:700;flex:0 0 16px}
.tl-av{width:30px;height:30px;border-radius:8px;flex:0 0 30px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:var(--gold-bri);border:1px solid var(--line)}
.tl-rname{font-size:13px;font-weight:700;flex:1;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-rhood{font-size:10px;color:var(--muted);font-weight:500}
.tl-wtick{font-size:11px;color:var(--gold);font-weight:800}
.tl-vs{font-family:'Bebas Neue',sans-serif;font-size:11px;color:var(--muted);text-align:center;padding:2px 0;letter-spacing:.2em;background:rgba(0,0,0,.25)}
.tl-cell{flex:1;display:flex;align-items:center;justify-content:center}
.tl-elbow{width:60%;height:46%;border:2px solid var(--gold-deep);border-left:none;border-radius:0 10px 10px 0;position:relative;opacity:.7}
.tl-champ{flex:0 0 188px;display:flex;flex-direction:column}
.tl-champbody{flex:1;display:flex;align-items:center;justify-content:center;padding:6px 0}
.tl-champcard{width:100%;border:1px solid var(--gold-deep);border-radius:16px;padding:22px 14px;text-align:center;background:radial-gradient(120% 120% at 50% 0%,rgba(212,175,55,.16),rgba(19,19,22,.9));box-shadow:0 0 40px rgba(212,175,55,.12)}
.tl-champlabel{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.12em;color:var(--gold-bri);margin-top:6px}
.tl-champtbd{font-size:11px;color:var(--muted);letter-spacing:.16em;text-transform:uppercase;margin-top:6px}
.tl-prize{font-size:11px;color:var(--gold);margin-top:14px;line-height:1.5;border-top:1px solid var(--line);padding-top:12px}
.tl-section{margin-top:42px}
.tl-stitle{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:.06em;color:var(--text)}
.tl-sdesc{font-size:13px;color:var(--muted);margin-top:4px;max-width:620px;line-height:1.6}
.tl-redeem{margin-top:18px;display:grid;gap:12px}
.tl-rcard{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px}
.tl-rcard.voted{border-color:var(--gold-deep)}
.tl-rinfo{flex:1;min-width:0}
.tl-rtop{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.tl-rcname{font-weight:800;font-size:15px}
.tl-rcshop{font-size:11px;color:var(--muted)}
.tl-bar{height:7px;background:rgba(255,255,255,.06);border-radius:6px;margin-top:9px;overflow:hidden}
.tl-fill{height:100%;background:linear-gradient(90deg,var(--gold-deep),var(--gold-bri));border-radius:6px;transition:width .5s}
.tl-pct{font-size:11px;color:var(--muted);margin-top:5px;letter-spacing:.04em}
.tl-vbtn{flex:0 0 auto;border:1px solid var(--gold-deep);background:transparent;color:var(--gold-bri);font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:10px 16px;border-radius:10px;cursor:pointer}
.tl-vbtn:hover{background:rgba(212,175,55,.12)}
.tl-vbtn.done{background:var(--gold);color:#1a1408;border-color:var(--gold)}
.tl-vbtn:disabled{cursor:default;opacity:.45}
.tl-votednote{font-size:12px;color:var(--gold);margin-top:12px;letter-spacing:.04em}
.tl-scrim{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);z-index:55}
.tl-drawer{position:fixed;top:0;right:0;height:100%;width:400px;max-width:92vw;z-index:56;background:linear-gradient(180deg,#121215,#0c0c0f);border-left:1px solid var(--line);box-shadow:-30px 0 60px rgba(0,0,0,.6);overflow-y:auto;animation:tlslide .26s ease}
@keyframes tlslide{from{transform:translateX(100%)}to{transform:translateX(0)}}
.tl-dhero{position:relative;height:150px;display:flex;align-items:flex-end;padding:16px}
.tl-dclose{position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:rgba(0,0,0,.4);color:var(--text);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.tl-dav{width:58px;height:58px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--gold-bri);border:1px solid var(--gold-deep);background:rgba(0,0,0,.35)}
.tl-dbody{padding:18px}
.tl-dseed{font-size:11px;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;font-weight:700}
.tl-dname{font-family:'Bebas Neue',sans-serif;font-size:34px;letter-spacing:.03em;line-height:.95;margin-top:4px}
.tl-dshop{font-size:13px;color:var(--muted);margin-top:6px}
.tl-spbadge{display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;font-weight:700;letter-spacing:.04em;color:#1a1408;background:linear-gradient(180deg,var(--gold-bri),var(--gold));padding:5px 11px;border-radius:999px}
.tl-dmeta{display:flex;gap:10px;margin-top:16px}
.tl-mtile{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:11px 12px}
.tl-mtile b{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--gold-bri);letter-spacing:.02em;display:block}
.tl-mtile span{display:block;font-size:10px;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-top:2px}
.tl-dlabel{font-size:11px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase;margin:20px 0 8px;font-weight:700}
.tl-dsig{font-size:14px;color:var(--text);line-height:1.5}
.tl-ba{display:flex;gap:10px;margin-top:8px}
.tl-batile{flex:1;border-radius:11px;height:118px;border:1px solid var(--line);position:relative;overflow:hidden;display:flex;align-items:flex-end}
.tl-batag{font-size:9px;letter-spacing:.16em;font-weight:800;text-transform:uppercase;padding:4px 8px;margin:8px;border-radius:5px;background:rgba(0,0,0,.55);color:var(--gold-bri);position:relative;z-index:2}
.tl-bagrid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:14px 14px;opacity:.5}
.tl-path{font-size:13px;color:var(--text);line-height:1.6;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:12px 14px}
.tl-book{width:100%;margin-top:22px;padding:15px;border-radius:13px;border:none;cursor:pointer;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.08em;color:#1a1408;background:linear-gradient(180deg,var(--gold-bri),var(--gold));box-shadow:0 10px 26px rgba(212,175,55,.25)}
.tl-store{width:100%;margin-top:10px;padding:12px;border-radius:11px;background:transparent;border:1px solid var(--line);color:var(--muted);font-weight:700;font-size:13px;cursor:pointer}
.tl-fav{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:10px;padding:11px;border-radius:11px;background:transparent;border:1px dashed var(--gold-deep);color:var(--gold-bri);font-weight:700;font-size:12px;cursor:pointer;letter-spacing:.04em}
.tl-fav.on{background:rgba(212,175,55,.12);border-style:solid}
.tl-foot{margin-top:40px;border-top:1px solid var(--line);padding-top:16px;font-size:11px;color:var(--muted);letter-spacing:.04em;line-height:1.6}
`;

function TLAvatar({ b, cls }) {
  const initials = (b.nick || b.name.split(" ")[0])[0] + b.name.split(" ").slice(-1)[0][0];
  return <div className={cls} style={{ background: `linear-gradient(150deg, ${b.grad[0]}, ${b.grad[1]})` }}>{initials.toUpperCase()}</div>;
}
function TLRow({ b, win, onClick }) {
  return (
    <div className={"tl-row" + (win ? " win" : "")} onClick={onClick}>
      <span className="tl-seed">{b.seed}</span><TLAvatar b={b} cls="tl-av" />
      <span className="tl-rname">{b.nick ? `${b.name.split(" ")[0]} "${b.nick}"` : b.name}<span className="tl-rhood"> · {b.hood}</span></span>
      {win && <span className="tl-wtick">✓</span>}
    </div>
  );
}
function TLMatch({ a, b, winner, tag, live, onPick }) {
  return (
    <div className={"tl-match" + (live ? " live" : "")}>
      <span className={"tl-mtag" + (live ? " live" : "")}>{tag}</span>
      <TLRow b={a} win={winner === a.id} onClick={() => onPick(a.id)} />
      <div className="tl-vs">VS</div>
      <TLRow b={b} win={winner === b.id} onClick={() => onPick(b.id)} />
    </div>
  );
}
function TLElbow() { return <div className="tl-cell"><div className="tl-elbow" /></div>; }

function Lineup({ status = "Semifinals Live", onBook, onStorefront, fire }) {
  const [sel, setSel] = useState(null);
  const [redVote, setRedVote] = useState(null);
  const [favs, setFavs] = useState({});
  const B = TL_BARBERS;
  const pick = (id) => setSel(id);
  const redData = useMemo(() => {
    const rows = TL_REDEMPTION.map((r) => ({ ...r, votes: r.base + (redVote === r.id ? 1 : 0) }));
    const total = rows.reduce((s, r) => s + r.votes, 0);
    return rows.map((r) => ({ ...r, pct: Math.round((r.votes / total) * 100) })).sort((a, b) => b.votes - a.votes);
  }, [redVote]);
  const selB = sel ? B[sel] : null;
  const winPath = {
    b1: "Def. (8) Khalil Reed in the Quarterfinals · Now in the Semifinal — LIVE",
    b5: "Upset (4) Quan Rivers in the Quarterfinals · Now in the Semifinal — LIVE",
    b3: "Def. (6) Jaylen Brooks in the Quarterfinals · Semifinal upcoming",
    b2: "Def. (7) Demarco Hayes in the Quarterfinals · Semifinal upcoming",
    b8: "Eliminated in the Quarterfinals · Eligible for the Redemption Wildcard",
    b4: "Eliminated in the Quarterfinals · Eligible for the Redemption Wildcard",
    b6: "Eliminated in the Quarterfinals · Eligible for the Redemption Wildcard",
    b7: "Eliminated in the Quarterfinals · Eligible for the Redemption Wildcard",
  };
  const book = () => selB.proId ? onBook(selB.proId) : fire("This contestant's storefront opens when The Lineup goes live", "check");
  const store = () => selB.proId ? onStorefront(selB.proId) : fire("This contestant's storefront opens when The Lineup goes live", "check");

  return (
    <div style={{ padding: "0 22px" }}>
      <style>{TL_CSS}</style>
      <div className="tl-root">
        <div className="tl-head">
          <div>
            <span className="tl-kicker">National Barber Championship</span>
            <div className="tl-word">The Lineup</div>
            <div className="tl-sub">Chicago Pilot · 2026 — powered by StyleProfiles</div>
          </div>
          <span className="tl-live"><span className="tl-dot" /> {status}</span>
        </div>
        <div className="tl-stats">
          <div className="tl-stat"><b>8</b><span>Finalists</span></div>
          <div className="tl-stat"><b>8</b><span>Neighborhoods</span></div>
          <div className="tl-stat"><b>$15K</b><span>Chair Grant</span></div>
          <div className="tl-stat"><b>4.8★</b><span>Min. Rating</span></div>
        </div>
        <div className="tl-bscroll">
          <div className="tl-bracket">
            <div className="tl-col">
              <div className="tl-head2">Quarterfinals</div>
              <div className="tl-body">
                <TLMatch a={B.b1} b={B.b8} winner="b1" tag="QF · Final" onPick={pick} />
                <TLMatch a={B.b4} b={B.b5} winner="b5" tag="QF · Upset" onPick={pick} />
                <TLMatch a={B.b3} b={B.b6} winner="b3" tag="QF · Final" onPick={pick} />
                <TLMatch a={B.b2} b={B.b7} winner="b2" tag="QF · Final" onPick={pick} />
              </div>
            </div>
            <div className="tl-conn"><div className="tl-cellpad" /><div className="tl-cbody"><TLElbow /><TLElbow /></div></div>
            <div className="tl-col">
              <div className="tl-head2">Semifinals</div>
              <div className="tl-body">
                <TLMatch a={B.b1} b={B.b5} winner={null} tag="Live now" live onPick={pick} />
                <TLMatch a={B.b3} b={B.b2} winner={null} tag="Up next" onPick={pick} />
              </div>
            </div>
            <div className="tl-conn"><div className="tl-cellpad" /><div className="tl-cbody"><TLElbow /></div></div>
            <div className="tl-col">
              <div className="tl-head2">Final</div>
              <div className="tl-body">
                <div className="tl-match">
                  <span className="tl-mtag">Championship</span>
                  <div className="tl-row" style={{ cursor: "default" }}><span className="tl-seed">?</span><div className="tl-av" style={{ background: "#16161b" }}>—</div><span className="tl-rname" style={{ color: "var(--muted)" }}>Winner SF1</span></div>
                  <div className="tl-vs">VS</div>
                  <div className="tl-row" style={{ cursor: "default" }}><span className="tl-seed">?</span><div className="tl-av" style={{ background: "#16161b" }}>—</div><span className="tl-rname" style={{ color: "var(--muted)" }}>Winner SF2</span></div>
                </div>
              </div>
            </div>
            <div className="tl-conn"><div className="tl-cellpad" /><div className="tl-cbody"><TLElbow /></div></div>
            <div className="tl-champ">
              <div className="tl-head2">Champion</div>
              <div className="tl-champbody">
                <div className="tl-champcard">
                  <div style={{ fontSize: 30 }}>👑</div>
                  <div className="tl-champlabel">Chicago Champ</div>
                  <div className="tl-champtbd">To be crowned</div>
                  <div className="tl-prize">$15K chair grant · featured StyleProfiles storefront · seat in the national bracket</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="tl-section">
          <div className="tl-stitle">Redemption Wildcard</div>
          <div className="tl-sdesc">One eliminated barber gets a second shot — and the fans decide who. Judges crown the champion; this vote is yours. One vote per verified account, weighted by Chicago metro.</div>
          <div className="tl-redeem">
            {redData.map((r) => { const b = B[r.id]; const voted = redVote === r.id; return (
              <div key={r.id} className={"tl-rcard" + (voted ? " voted" : "")}>
                <TLAvatar b={b} cls="tl-av" />
                <div className="tl-rinfo">
                  <div className="tl-rtop"><span className="tl-rcname">{b.nick ? `${b.name.split(" ")[0]} "${b.nick}" ${b.name.split(" ").slice(-1)}` : b.name}</span><span className="tl-rcshop">{b.shop} · {b.hood}</span></div>
                  <div className="tl-bar"><div className="tl-fill" style={{ width: r.pct + "%" }} /></div>
                  <div className="tl-pct">{r.pct}% · {r.votes.toLocaleString()} votes</div>
                </div>
                <button className={"tl-vbtn" + (voted ? " done" : "")} disabled={redVote && !voted} onClick={() => { if (!redVote) { setRedVote(r.id); fire("Wildcard vote counted — repping " + b.hood, "crown"); } }}>{voted ? "Voted" : "Vote"}</button>
              </div>
            ); })}
          </div>
          {redVote && <div className="tl-votednote">✓ Your wildcard vote is locked in. Results reveal before the Final.</div>}
        </div>
        <div className="tl-foot">The Lineup is judge-decided; fan voting drives the Redemption Wildcard and Fan Favorite only. Tap any barber to open their profile and book. (Prototype — outcomes simulated.)</div>
      </div>

      {selB && (<>
        <div className="tl-scrim" onClick={() => setSel(null)} />
        <div className="tl-drawer">
          <div className="tl-dhero" style={{ background: `linear-gradient(150deg, ${selB.grad[0]}, ${selB.grad[1]})` }}>
            <button className="tl-dclose" onClick={() => setSel(null)}>✕</button><TLAvatar b={selB} cls="tl-dav" />
          </div>
          <div className="tl-dbody">
            <div className="tl-dseed">Seed #{selB.seed}</div>
            <div className="tl-dname">{selB.nick ? `${selB.name.split(" ")[0]} "${selB.nick}" ${selB.name.split(" ").slice(-1)}` : selB.name}</div>
            <div className="tl-dshop">{selB.shop} · {selB.hood}, Chicago</div>
            {selB.proId && <div className="tl-spbadge"><BadgeCheck size={13} /> On StyleProfiles · book now</div>}
            <div className="tl-dmeta">
              <div className="tl-mtile"><b>{selB.rating.toFixed(1)}★</b><span>SP Rating</span></div>
              <div className="tl-mtile"><b>{selB.bookings.toLocaleString()}</b><span>Bookings</span></div>
              <div className="tl-mtile"><b>#{selB.seed}</b><span>Seed</span></div>
            </div>
            <div className="tl-dlabel">Signature</div><div className="tl-dsig">{selB.sig}</div>
            <div className="tl-dlabel">The Reveal</div>
            <div className="tl-ba">
              <div className="tl-batile" style={{ background: "linear-gradient(160deg,#1a1a1f,#0c0c0f)" }}><div className="tl-bagrid" /><span className="tl-batag">Before</span></div>
              <div className="tl-batile" style={{ background: `linear-gradient(160deg, ${selB.grad[0]}, ${selB.grad[1]})` }}><div className="tl-bagrid" /><span className="tl-batag">After</span></div>
            </div>
            <div className="tl-dlabel">Tournament Path</div><div className="tl-path">{winPath[selB.id]}</div>
            <button className="tl-book" onClick={book}>Book this barber</button>
            <button className="tl-store" onClick={store}>View full storefront</button>
            <button className={"tl-fav" + (favs[selB.id] ? " on" : "")} onClick={() => { setFavs((f) => ({ ...f, [selB.id]: !f[selB.id] })); if (!favs[selB.id]) fire("Fan Favorite vote cast", "crown"); }}>{favs[selB.id] ? "♥ Fan Favorite vote cast" : "♡ Vote Fan Favorite"}</button>
          </div>
        </div>
      </>)}
    </div>
  );
}

/* ------------------------------ notifications ----------------------------- */
function NotifPanel({ items, onItem, close, markAll, onSettings }) {
  const iconFor = (k) => ({ tag: Tag, points: Sparkles, awards: Crown, booking: Calendar, review: Star, chair: Megaphone, report: Flag, sub: ImageIcon, vote: ShieldCheck, announce: Megaphone, deal: Zap }[k] || Bell);
  return (
    <div className="absolute" style={{ right: 0, top: 46, width: 320, zIndex: 70, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.85)" }}>
      <div className="flex items-center justify-between" style={{ padding: "13px 15px", borderBottom: `1px solid ${C.lineSoft}` }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
        <button onClick={markAll} style={{ background: "none", border: "none", color: C.gold, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Mark all read</button>
      </div>
      <div style={{ maxHeight: 340, overflow: "auto" }}>
        {items.length === 0 && <div style={{ padding: 26, textAlign: "center", color: C.sub, fontSize: 13 }}>You're all caught up.</div>}
        {items.map((n) => { const Icon = iconFor(n.icon); return (
          <button key={n.id} onClick={() => { onItem(n); close(); }} className="flex items-center text-left" style={{ width: "100%", gap: 11, padding: "12px 15px", background: n.read ? "transparent" : "rgba(232,194,107,0.05)", border: "none", borderTop: `1px solid ${C.lineSoft}`, cursor: n.screen ? "pointer" : "default" }}>
            <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `${C.gold}14`, border: `1px solid ${C.gold}33` }}><Icon size={15} style={{ color: C.gold }} /></div>
            <span style={{ fontSize: 13, lineHeight: 1.4 }}>{n.text}</span>
            {!n.read && <span style={{ width: 7, height: 7, borderRadius: 7, background: C.gold, marginLeft: "auto", flexShrink: 0 }} />}
          </button>); })}
      </div>
      <button onClick={() => { onSettings(); close(); }} className="flex items-center justify-center" style={{ width: "100%", gap: 7, padding: "11px 15px", background: "none", border: "none", borderTop: `1px solid ${C.lineSoft}`, color: C.sub, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><Settings size={13} /> Notification settings</button>
    </div>
  );
}

/* ------------------------------- shell ------------------------------------ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap');
* { box-sizing: border-box; }
.sp-root { font-family: 'Hanken Grotesk', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.sp-root button, .sp-root input, .sp-root select, .sp-root textarea { font-family: 'Hanken Grotesk', sans-serif; }
.sp-root ::-webkit-scrollbar { width: 9px; height: 9px; }
.sp-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 9px; }
@keyframes spIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.sp-fade { animation: spIn .4s ease both; }
`;

const SEED_NOTIFS = [
  { id: "n1", role: "client", icon: "tag", text: "Imani Brooks wants to tag you in a contest entry.", screen: "tags" },
  { id: "n2", role: "client", icon: "points", text: "You earned +130 StylePoints from your last visit.", screen: "wallet" },
  { id: "n3", role: "client", icon: "awards", text: "Voting closes in 6 days — back your favorites.", screen: "awards" },
  { id: "n4", role: "pro", icon: "booking", text: "New booking: Jordan P. · Signature Fade, today 3:00 PM.", screen: "dashboard" },
  { id: "n5", role: "pro", icon: "review", text: "Andre M. left you a 5★ review.", screen: "profile" },
  { id: "n6", role: "pro", icon: "awards", text: "You're #1 for Barber of the Month.", screen: "awards" },
  { id: "n7", role: "pro", icon: "chair", text: "2 clients are on your waitlist for tomorrow.", screen: "fillchair" },
  { id: "n8", role: "admin", icon: "sub", text: "5 contest submissions awaiting review.", screen: "admin" },
  { id: "n9", role: "admin", icon: "report", text: "New report: possible stolen portfolio image.", screen: "admin" },
  { id: "n10", role: "admin", icon: "vote", text: "Vote anomaly flagged in Nail Tech category.", screen: "admin" },
  { id: "n11", role: "client", icon: "awards", text: "The Lineup: Semifinals are live — go watch.", screen: "lineup", feat: "lineup" },
  { id: "n12", role: "client", icon: "crown", text: "Redemption Wildcard voting closes before the Final.", screen: "lineup", feat: "lineup" },
  { id: "n13", role: "pro", icon: "awards", text: "You're competing in The Lineup — Semifinal is LIVE.", screen: "dashboard", feat: "lineup" },
];

export default function StyleProfiles() {
  const [view, setView] = useState("client"); // client | pro | admin
  const [screen, setScreen] = useState("landing");
  const [activePro, setActivePro] = useState(null);
  const [booking, setBooking] = useState(null);
  const [appts, setAppts] = useState([]);
  const [points, setPoints] = useState(620);
  const [favs, setFavs] = useState({});
  const [votes, setVotes] = useState(SEED_VOTES);
  const [voted, setVoted] = useState({});
  const [reviews, setReviews] = useState(SEED_REVIEWS);
  const [tags, setTags] = useState(SEED_TAGS);
  const [promos, setPromos] = useState([]);
  const [mySubmission, setMySubmission] = useState(null);
  const [subs, setSubs] = useState(SEED_SUBS);
  const [reports, setReports] = useState(SEED_REPORTS);
  const [flagVotes, setFlagVotes] = useState(SEED_FLAGVOTES);
  const [winners, setWinners] = useState({});
  const [catActive, setCatActive] = useState(Object.fromEntries(CATS.map((c) => [c.key, true])));
  const [notifs, setNotifs] = useState(SEED_NOTIFS);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [household, setHousehold] = useState([
    { id: "me", name: "You", tag: "Primary account", color: "#56C2FF" },
    { id: "m1", name: "Marcus Jr.", tag: "Child · 8", color: "#F4A93C" },
    { id: "m2", name: "Amara", tag: "Child · 11", color: "#FF6FA5" },
    { id: "m3", name: "Jasmine", tag: "Adult", color: "#A78BFA" },
  ]);
  const addMember = (name, type) => {
    const id = "m" + Date.now();
    const palette = ["#34D399", "#56C2FF", "#FF8A5B", "#A78BFA", "#F472D0", "#F4A93C"];
    setHousehold((h) => [...h, { id, name, tag: type, color: palette[h.length % palette.length] }]);
    return id;
  };
  const [memberships, setMemberships] = useState([]);
  const [proTiers, setProTiers] = useState(() => JSON.parse(JSON.stringify(MEMBERSHIPS)));
  const addTier = (proId) => setProTiers((t) => ({ ...t, [proId]: [...(t[proId] || []), { id: "t" + Date.now(), name: "New tier", price: 50, includes: "1 service / month", perks: [] }] }));
  const updateTier = (proId, id, patch) => setProTiers((t) => ({ ...t, [proId]: (t[proId] || []).map((x) => x.id === id ? { ...x, ...patch } : x) }));
  const deleteTier = (proId, id) => setProTiers((t) => ({ ...t, [proId]: (t[proId] || []).filter((x) => x.id !== id) }));
  const [marketplaceOn, setMarketplaceOn] = useState(false);
  const [prodAvail, setProdAvail] = useState(() => Object.fromEntries(PRODUCTS.map((p) => [p.id, true])));
  const toggleProd = (id) => setProdAvail((s) => ({ ...s, [id]: !s[id] }));
  const [productCart, setProductCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const cartCount = Object.values(productCart).reduce((a, b) => a + b, 0);
  const addToCart = (id) => setProductCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const setQty = (id, q) => setProductCart((c) => { const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });
  const removeFromCart = (id) => setProductCart((c) => { const n = { ...c }; delete n[id]; return n; });
  const shopProduct = (id) => { addToCart(id); fire(`Added ${productById(id).name} to cart`, "check"); };
  const checkoutCart = (total) => { setProductCart({}); setCartOpen(false); fire(`Order placed · $${total}`, "check"); };
  const [lineupOn, setLineupOn] = useState(false);
  const [lineupStatus, setLineupStatus] = useState("Semifinals Live");

  const tier = points >= 1000 ? "Gold" : points >= 500 ? "Silver" : "Bronze";
  const fire = (msg, icon) => { setToast({ msg, icon }); setTimeout(() => setToast(null), 2600); };
  const go = (s) => { setScreen(s); setNotifOpen(false); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  const openPro = (id) => { setActivePro(id); go("profile"); };

  const confirmBooking = (bk) => {
    setAppts((a) => [...a, { ...bk, id: Date.now() }]);
    setPoints((p) => p + bk.pts); setBooking(null);
    if (bk.membership) {
      setMemberships((m) => m.some((x) => x.proId === bk.membership.proId) ? m : [...m, bk.membership]);
      fire(`Joined ${bk.membership.name} · +${bk.pts} StylePoints`, "crown");
    } else {
      const who = bk.people && bk.people.includes("people") ? ` for ${bk.people}` : "";
      fire(`Booked with ${first(bk.pro.name)}${who} · +${bk.pts} StylePoints`, "check");
    }
  };
  const cancelAppt = (id) => { setAppts((a) => a.filter((x) => x.id !== id)); fire("Appointment cancelled · deposit refunded", "check"); };
  const rebook = (pro, service) => setBooking({ pro, service });
  const redeem = (cost, name) => { setPoints((p) => p - cost); fire(`Redeemed: ${name}`, "gift"); };
  const castVote = (cat, id) => {
    setVotes((v) => ({ ...v, [cat]: { ...(v[cat] || {}), [id]: ((v[cat] && v[cat][id]) || 0) + 1 } }));
    setVoted((v) => ({ ...v, [cat]: id })); fire(`Vote counted for ${first(proById(id).name)}`, "crown");
  };
  const addReview = (proId, r) => { setReviews((s) => ({ ...s, [proId]: [r, ...(s[proId] || [])] })); fire("Review posted — thanks!", "check"); };
  const resolveTag = (id, choice, pro) => {
    setTags((t) => t.map((x) => x.id === id ? { ...x, status: choice } : x));
    const msg = choice === "declined" ? `Declined — ${first(pro.name)} can't tag you` : choice === "public" ? `Public tag approved for ${first(pro.name)}` : choice === "private" ? "Private approval — profile stays unlinked" : "Anonymous approval recorded";
    fire(msg, choice === "declined" ? "ban" : "check");
  };
  const createPromo = (p) => { setPromos((s) => [{ ...p, id: Date.now(), slotsClaimed: 0, status: "live" }, ...s]); fire(`Flash deal sent to ${p.notified} clients`, "deal"); };
  const claimPromo = (id) => { setPromos((s) => s.map((p) => { if (p.id !== id) return p; const claimed = Math.min(p.slots, p.slotsClaimed + 1); return { ...p, slotsClaimed: claimed, status: claimed >= p.slots ? "closed" : p.status }; })); fire("Slot claimed — deposit secured", "check"); };
  const [broadcasts, setBroadcasts] = useState([]);
  const sendBroadcast = (b) => {
    const recipients = b.audience === "All pros" ? 8 : b.audience === "All clients" ? 1840 : 1848;
    const delivered = Math.round(recipients * 0.98);
    const openRate = 40 + Math.floor(Math.random() * 25);
    setBroadcasts((s) => [{ ...b, id: Date.now(), recipients, delivered, openRate }, ...s]);
    if (!b.scheduled) {
      const roles = b.audience === "All pros" ? ["pro"] : b.audience === "All clients" ? ["client"] : ["client", "pro"];
      const channelNote = b.inApp && b.email ? "" : b.email ? " (email)" : "";
      setNotifs((ns) => [
        ...roles.map((r, i) => ({ id: "bc" + Date.now() + i, role: r, icon: "announce", text: `${b.title}${channelNote}`, screen: null })),
        ...ns,
      ]);
      fire(`Announcement sent to ${recipients.toLocaleString()} people`, "check");
    } else {
      fire(`Announcement scheduled · ${b.when}`, "check");
    }
  };
  const [notifPrefs, setNotifPrefs] = useState({
    deals: { inApp: true, email: true }, reminders: { inApp: true, email: true },
    announcements: { inApp: true, email: false }, awards: { inApp: true, email: false },
    lineup: { inApp: true, email: false }, quietStart: "10:00 PM", quietEnd: "8:00 AM",
  });
  const setPref = (cat, channel, val) => setNotifPrefs((p) => channel ? { ...p, [cat]: { ...p[cat], [channel]: val } } : { ...p, [cat]: val });
  const submitToAwards = (cat, look) => {
    setMySubmission(look);
    setVotes((v) => ({ ...v, [cat]: { ...(v[cat] || {}), p1: (v[cat] && v[cat].p1) || 0 } }));
    fire(`Entered ${look} into ${catOf(cat).label} of the Month`, "crown");
  };

  const roleNotifs = notifs.filter((n) => n.role === view && (n.feat !== "lineup" || lineupOn));
  const unread = roleNotifs.filter((n) => !n.read).length;
  const markAll = () => setNotifs((ns) => ns.map((n) => n.role === view ? { ...n, read: true } : n));
  const onNotif = (n) => { setNotifs((ns) => ns.map((x) => x.id === n.id ? { ...x, read: true } : x)); if (n.screen) go(n.screen); };

  const clientTabs = [ { k: "discover", label: "Discover", icon: Search }, { k: "appointments", label: "Appointments", icon: Calendar }, { k: "awards", label: "Awards", icon: Crown }, { k: "wallet", label: "Wallet", icon: Gift }, { k: "tags", label: "Tag requests", icon: Tag }, ...(lineupOn ? [{ k: "lineup", label: "The Lineup", icon: Swords }] : []), ...(marketplaceOn ? [{ k: "shop", label: "Shop", icon: ShoppingBag }] : []) ];
  const proTabs = [ { k: "dashboard", label: "Dashboard", icon: TrendingUp }, { k: "profile", label: "My Profile", icon: Users }, { k: "memberships", label: "Memberships", icon: Gem }, { k: "fillchair", label: "Fill My Chair", icon: Megaphone }, { k: "awards", label: "Awards", icon: Crown } ];
  const tabs = view === "pro" ? proTabs : view === "client" ? clientTabs : [];
  const profilePro = view === "pro" ? proById("p1") : (proById(activePro) || PROS[0]);
  const pendingTags = tags.filter((t) => t.status === "pending").length;

  return (
    <div className="sp-root" style={{ minHeight: 640, background: C.bg, color: C.text,
      backgroundImage: `radial-gradient(circle at 12% -5%, rgba(232,194,107,0.10), transparent 40%), radial-gradient(circle at 95% 8%, rgba(255,111,165,0.06), transparent 42%)` }}>
      <style>{CSS}</style>

      <div className="flex items-center justify-between" style={{ position: "sticky", top: 0, zIndex: 50, padding: "14px 22px", borderBottom: `1px solid ${C.line}`, background: "rgba(11,11,14,0.82)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => go("landing")} className="flex items-center" style={{ gap: 9, background: "none", border: "none", cursor: "pointer" }}>
          <div className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, background: C.goldGrad }}><Crown size={17} style={{ color: "#1A1306" }} /></div>
          <span style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>StyleProfiles</span>
        </button>
        <div className="flex items-center" style={{ gap: 12 }}>
          <div className="flex" style={{ padding: 3, borderRadius: 999, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}` }}>
            {[["client", "Client"], ["pro", "Pro"], ["admin", "Admin"]].map(([k, l]) => (
              <button key={k} onClick={() => { setView(k); go(k === "pro" ? "dashboard" : k === "admin" ? "admin" : "discover"); }} className="font-semibold" style={{ padding: "6px 13px", borderRadius: 999, fontSize: 13, cursor: "pointer", border: "none", background: view === k ? C.goldGrad : "transparent", color: view === k ? "#1A1306" : C.sub }}>{l}</button>
            ))}
          </div>
          {view === "client" && <button onClick={() => go("wallet")} className="flex items-center" style={{ gap: 6, padding: "7px 12px", borderRadius: 999, cursor: "pointer", background: `${C.gold}14`, border: `1px solid ${C.gold}40`, color: C.gold, fontWeight: 700, fontSize: 13 }}><Sparkles size={14} /> {points.toLocaleString()}</button>}
          {view === "client" && marketplaceOn && (
            <button onClick={() => setCartOpen(true)} className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, cursor: "pointer", position: "relative" }}>
              <ShoppingBag size={17} style={{ color: cartCount ? C.gold : C.sub }} />
              {cartCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999, background: C.gold, color: "#1A1306", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{cartCount}</span>}
            </button>
          )}
          <div className="relative">
            <button onClick={() => setNotifOpen((o) => !o)} className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: notifOpen ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, cursor: "pointer", position: "relative" }}>
              <Bell size={17} style={{ color: unread ? C.gold : C.sub }} />
              {unread > 0 && <span style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999, background: "#FF6FA5", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{unread}</span>}
            </button>
            {notifOpen && <NotifPanel items={roleNotifs} onItem={onNotif} close={() => setNotifOpen(false)} markAll={markAll} onSettings={() => go("prefs")} />}
          </div>
        </div>
      </div>

      {screen !== "landing" && tabs.length > 0 && (
        <div className="flex items-center" style={{ gap: 6, padding: "12px 22px 0", maxWidth: 1080, margin: "0 auto", overflowX: "auto" }}>
          {tabs.map((t) => { const Icon = t.icon; const on = screen === t.k; const badge = t.k === "tags" ? pendingTags : 0; return (
            <button key={t.k} onClick={() => go(t.k)} className="font-semibold inline-flex items-center" style={{ gap: 7, padding: "9px 15px", borderRadius: 11, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap", background: on ? "rgba(255,255,255,0.06)" : "transparent", color: on ? C.text : C.sub, border: `1px solid ${on ? C.line : "transparent"}` }}>
              <Icon size={15} style={{ color: on ? C.gold : C.sub }} /> {t.label}{badge > 0 && <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 999, background: `${C.gold}26`, color: C.gold }}>{badge}</span>}
            </button>); })}
        </div>
      )}

      <div className="sp-fade" key={screen + view + (activePro || "")}>
        {screen === "landing" && <Landing go={go} setView={setView} />}
        {screen === "discover" && <Discover openPro={openPro} />}
        {screen === "appointments" && <Appointments appts={appts} cancelAppt={cancelAppt} onRebook={rebook} openPro={openPro} />}
        {screen === "profile" && (
          <ProProfile pro={profilePro} back={() => go(view === "pro" ? "dashboard" : "discover")}
            book={(svc) => setBooking({ pro: profilePro, service: svc })} isOwner={view === "pro"}
            fav={() => setFavs((f) => ({ ...f, [profilePro.id]: !f[profilePro.id] }))} isFav={!!favs[profilePro.id]}
            reviews={reviews[profilePro.id] || []} addReview={addReview}
            submitToAwards={submitToAwards} mySubmission={view === "pro" ? mySubmission : null} />
        )}
        {screen === "wallet" && <Wallet points={points} tier={tier} redeem={redeem} appts={appts} memberships={memberships} />}
        {screen === "tags" && <TagRequests requests={tags} resolve={resolveTag} />}
        {screen === "fillchair" && <FillMyChair promos={promos} create={createPromo} claim={claimPromo} />}
        {screen === "prefs" && <NotifPrefs prefs={notifPrefs} setPref={setPref} back={() => go(view === "pro" ? "dashboard" : "discover")} />}
        {screen === "memberships" && <MembershipManager proId="p1" tiers={proTiers["p1"] || []} addTier={addTier} updateTier={updateTier} deleteTier={deleteTier} />}
        {screen === "shop" && marketplaceOn && <Marketplace products={PRODUCTS} avail={prodAvail} cart={productCart} addToCart={shopProduct} />}
        {screen === "lineup" && lineupOn && <Lineup status={lineupStatus} onBook={(id) => setBooking({ pro: proById(id), service: proById(id).services[0] })} onStorefront={(id) => openPro(id)} fire={fire} />}
        {screen === "awards" && <Awards votes={votes} vote={castVote} voted={voted} winners={winners} />}
        {screen === "dashboard" && <Dashboard go={go} appts={appts} votes={votes} lineupOn={lineupOn} lineupStatus={lineupStatus} fire={fire} />}
        {screen === "admin" && <Admin subs={subs} setSubs={setSubs} reports={reports} setReports={setReports} flagVotes={flagVotes} setFlagVotes={setFlagVotes} winners={winners} setWinners={setWinners} catActive={catActive} setCatActive={setCatActive} marketplaceOn={marketplaceOn} setMarketplaceOn={setMarketplaceOn} prodAvail={prodAvail} toggleProd={toggleProd} lineupOn={lineupOn} setLineupOn={setLineupOn} lineupStatus={lineupStatus} setLineupStatus={setLineupStatus} broadcasts={broadcasts} sendBroadcast={sendBroadcast} fire={fire} />}
      </div>

      {booking && <Booking pro={booking.pro} seedService={booking.service} household={household} addMember={addMember} tiers={proTiers[booking.pro.id] || []} marketplaceOn={marketplaceOn} avail={prodAvail} shopProduct={shopProduct} close={() => setBooking(null)} confirm={confirmBooking} />}
      {cartOpen && <CartDrawer cart={productCart} setQty={setQty} removeFromCart={removeFromCart} checkout={checkoutCart} close={() => setCartOpen(false)} />}

      {toast && (
        <div className="flex items-center" style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 80, gap: 10, padding: "13px 18px", borderRadius: 14, background: C.surface2, border: `1px solid ${C.gold}55`, boxShadow: "0 18px 40px -18px rgba(0,0,0,0.8)", maxWidth: "92%" }}>
          <div className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 8, background: toast.icon === "ban" ? "#FF6FA5" : C.goldGrad }}>
            {toast.icon === "crown" ? <Crown size={15} style={{ color: "#1A1306" }} /> : toast.icon === "gift" ? <Gift size={15} style={{ color: "#1A1306" }} /> : toast.icon === "ban" ? <Ban size={15} style={{ color: "#fff" }} /> : <Check size={15} style={{ color: "#1A1306" }} />}
          </div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{toast.msg}</span>
        </div>
      )}

      <div style={{ textAlign: "center", color: C.sub, fontSize: 11.5, padding: "8px 22px 26px", opacity: 0.7 }}>StyleProfiles — interactive prototype · payments, auth, voting &amp; moderation are simulated</div>
    </div>
  );
}
