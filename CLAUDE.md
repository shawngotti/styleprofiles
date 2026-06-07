# StyleProfiles — Claude Code Kickoff

> **How to use this file (two options):**
> 1. **Paste it** as your first message to Claude Code in your project directory, or
> 2. **Save it as `CLAUDE.md` at your repo root** — Claude Code reads `CLAUDE.md` automatically at the start of every session, so this context persists across sessions without re-pasting.
>
> Before starting, place these three files in the repo (e.g. in `/docs`):
> `StyleProfiles.jsx` (the clickable prototype = UX spec), `styleprofiles_schema.sql` (the database foundation), and `StyleProfiles_Architecture_and_Backlog.md` (architecture + ordered build tickets). Read all three before writing code.

---

## What we're building

**StyleProfiles** — a multi-sided marketplace for beauty & grooming professionals: discovery, group/household booking with deposits, StylePoints loyalty, pro-defined memberships, reviews, monthly category awards, a toggle-able self-care marketplace, an admin moderation console, and **The Lineup** (a season bracket competition layered on top). A clickable prototype of the entire experience already exists; your job is to build the production backend underneath it.

## Stack

- **Frontend:** React + Tailwind (dark theme, gold accents). The prototype `StyleProfiles.jsx` is the visual + interaction spec — preserve its screens and flows.
- **Backend:** Supabase (Postgres + Row Level Security + Storage + Edge Functions + cron).
- **Payments:** Stripe Connect (pro payouts, deposits, subscriptions, marketplace, prize payouts).

## The two-layer model

The prototype is the **front-end spec** (in-memory, simulated). You are building the **production layer**. Migrate **screen by screen**: keep each prototype component, replace its `useState` seed data with real Supabase queries and Edge Function calls. The UI should barely change; the data layer is built underneath it.

---

## Operating principles (do not deviate)

1. **Server-authoritative by default.** Anything touching money, points, votes, or eligibility is enforced server-side (Edge Function + DB constraint), never trusted from the browser. See §2 "Where logic lives" in the architecture doc — follow that table exactly.
2. **RLS is already written and is the security boundary.** The perspective switcher (Client/Pro/Admin) in the UI is a convenience, not a security mechanism. Never weaken RLS to make a feature work; fix the query or the policy intentionally.
3. **Money is the source-of-truth problem.** Stripe is authoritative for payment/subscription state; mirror it into the DB only via webhook handlers, never optimistically.
4. **Points are a ledger.** `loyalty_transactions` is the truth; never let a client set a balance.
5. **Two distinct scoring systems** — Monthly Awards (50/20/20/10) and The Lineup judge rubric (technical 30 / creative 25 / reveal 20 / client_experience 15 / composure 10). Do not conflate them. Fan votes never decide Lineup bracket outcomes — only the Redemption Wildcard and Fan Favorite.
6. **Feature flags gate the API, not just the UI.** `platform_settings` controls `marketplace_on` and `lineup_on`. A disabled feature's endpoints must reject calls and its data must be unreachable — "build it dark, launch later" depends on this.
7. **Work one ticket at a time.** Implement, test, and confirm each backlog item before moving to the next. Show your plan before large changes.

---

## Settle these decisions first (ask me before coding)

From §6 of the architecture doc — confirm with me before Batch 6:

1. **Money type** — ✅ **RESOLVED: integer cents.** Schema converted from `numeric(10,2)` to `integer` (cents).
2. **Live-event ticketing** — in-app Stripe, or keep **Posh.Vip** + sync? (Posh.Vip recommended near-term.)
3. **Fan-vote eligibility** — ✅ **RESOLVED: any verified account** (no separate "fan" role).
4. **Video reveals** — needed for Lineup rounds? If so, pick a transcoding/CDN path now.
5. **Champion placement** — fixed discovery boost vs time-limited featured slot.
6. **Multi-provider group booking** — ✅ **RESOLVED: deferred** (group booking stays N line items under one parent + one deposit).

---

## Start here — Batch 6: Auth & roles

Prerequisites to confirm or set up: a Supabase project (URL + keys in env), Stripe account (test mode) for later batches, and the schema applied.

1. **Apply the schema.** Run `styleprofiles_schema.sql` as the first migration. Verify all 43 tables, the enums, RLS, and seed categories created cleanly.
2. **Run the Batch 6 starter SQL** from Appendix A of the architecture doc: the `handle_new_user` trigger (creates `profiles` + default `client` role on signup) and the admin-guarded `grant_pro_role` function.
3. **Wire Supabase Auth** — email + at least one OAuth provider.
4. **Build the client auth context** — load the session and the user's `user_roles` on app start; drive the perspective switcher from it. Roles are additive (a person can be client + pro).
5. **Lock role elevation** — `pro` only via the approval path; `judge`/`admin` admin-only. Never client-self-grantable.
6. **Acceptance test** — sign in as three users (client, pro, admin) and prove RLS holds: a client cannot read another client's bookings or a pro's private data; a pro cannot edit another pro's services; only admins can write `platform_settings`, award winners, and competition data; a fan can only insert a vote while a voting window is open.

When Batch 6 passes its acceptance test, proceed to **Batch 7 (core booking backend)** and continue down §5 of the architecture doc in order.

---

## Reference files (read before coding)

- `docs/StyleProfiles.jsx` — UX/interaction spec (every screen and flow).
- `docs/styleprofiles_schema.sql` — applied database foundation (tables, RLS, constraints, feature-flag seed).
- `docs/StyleProfiles_Architecture_and_Backlog.md` — where logic lives (§2), engine designs you must build correctly (§4), the ordered backlog (§5), open decisions (§6), and the runnable Batch 6 starter SQL (Appendix A).

**Golden rule:** when the prototype and the architecture doc seem to disagree, the prototype defines *what the experience is* and the architecture doc defines *how it must be built safely*. If a real conflict remains, ask me.
