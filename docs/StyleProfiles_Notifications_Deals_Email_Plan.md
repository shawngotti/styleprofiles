# StyleProfiles — Notifications, Deals & Email
### Web-app project plan (no native-push features)

This plan covers the engagement layer we scoped: admin announcements, pro flash deals, and automated lifecycle messages — delivered through **in-app notifications + email only**. Everything here ships on the web with no mobile app required. Native phone push is explicitly **out of scope** (see §8). It slots into the master backlog as a new track ("Batch 13 — Engagement") and reuses systems you already have rather than rebuilding them.

---

## 1. Scope in one line

Reach clients and pros with the right message at the right time — announcements, time-sensitive deals, and booking lifecycle messages — over two channels (**in-app** and **email**), with the controls to keep that channel from becoming noise.

**Reuses what exists:** the `notifications` table + notification panel (in-app), and **Fill My Chair** (which evolves into flash deals). The genuinely new infrastructure is the **email channel**.

---

## 2. Delivery channels

- **In-app** *(exists, extend)* — the bell + panel. Works everywhere the user is logged in. Necessary but only seen when someone opens the app.
- **Email** *(new)* — reaches people who aren't currently in the app. Provider: **Resend** (free 3,000 emails/mo → $20/mo for 50,000; see §7). Handles confirmations, reminders, deal blasts, announcements, win-back.

**Principle:** every message can target in-app, email, or both. The recipient's **preferences** decide what they actually receive.

---

## 3. The features

**A. Admin broadcast composer.** Compose an announcement (news, a product, a service), choose an **audience** (all pros / all clients / everyone / a segment), choose **channels** (in-app / email / both), and **send now or schedule**. Routes through the existing notification system so it inherits read-state, gating, and history.

**B. Pro flash deals** *(evolution of Fill My Chair)*. A pro posts a time-sensitive deal: a **discount or set price**, a **capped number of slots**, and an **expiry**. It shows a live **countdown** and **claimed X/N**, and **auto-closes** when full or expired. Blasted to the chosen audience via in-app + email. **Guardrails:** the deposit still applies (a flash booking isn't a no-show risk), a **discount floor**, and a **frequency cap** per pro.

**C. Notification preferences + quiet hours.** Per-user control over categories (deals, awards, The Lineup, booking reminders, announcements), per-channel (in-app vs email), plus quiet hours and a required email unsubscribe. This is the guardrail that keeps the whole channel alive — treated as a requirement, not an extra.

**D. Booking reminders.** Automated "your appointment is tomorrow / you're up next" messages. The single highest-ROI use of the channel for reducing no-shows; pairs with the deposit system.

**E. Win-back.** Automated re-engagement for lapsed clients (e.g. no booking in 60 days), admin-configurable as a segment + message.

**F. Deal discovery surface** *(optional / later)*. A "Deals near you" view so flash deals become a destination, not just a one-off blast. Gated like the marketplace.

**G. Delivery analytics.** Sent / delivered / opened / claimed — for admin (broadcasts) and pros (deals). Without it no one can tell whether a message worked.

---

## 4. Prototype-now vs production

**Buildable now in the prototype (simulated sends):**
- Admin broadcast composer UI (audience + channel pickers, schedule control).
- Flash deals UI (composer, countdown, slot counter, claim, auto-close) — evolving Fill My Chair.
- Notification preferences + quiet hours UI.
- Deal discovery surface.
- Analytics displays (with sample data).

**Production (real backend, Claude Code):**
- Actual email sending via Resend, scheduling jobs, real delivery/open tracking, segment queries, automated reminder/win-back jobs.

---

## 5. Build sequence (ordered by dependency)

**Phase A — Prototype layer** *(build now in `StyleProfiles.jsx`)*
Broadcast composer, flash deals, preferences/quiet hours, deal discovery, analytics displays — all simulated. Validates the UX and the decision logic before any backend spend.

**Phase B — Email foundation** *(production; needs Batch 6 auth)*
Integrate Resend, verify sending domain, build templates, unsubscribe + suppression. *(This is the folded-in email work — see §7.)*

**Phase C — Broadcast backend** *(needs B)*
Audience-segment queries, send-now + scheduled (cron), in-app + email fan-out, delivery logging.

**Phase D — Flash-deals backend** *(needs Batch 7 booking + Batch 8 payments)*
Deal entity, slot accounting with integrity, expiry/auto-close jobs, deposit-on-claim, discount application, blast via Phase C.

**Phase E — Lifecycle automation** *(needs B + Batch 7)*
Booking reminders + win-back, recurring schedulers, all respecting preferences/quiet hours.

**Phase F — Analytics** *(needs C/D)*
Delivery + claim metrics surfaced to admin and pros.

---

## 6. Schema additions

Append to `styleprofiles_schema.sql`. Full DDL in Appendix A (validated). New tables:

- `notification_preferences` — per-user, per-category channel choices + quiet hours.
- `broadcasts` — an admin announcement (audience, channels, schedule, status).
- `flash_deals` — pro deal (price/discount, slot cap, expiry, status, audience).
- `flash_deal_claims` — a client claiming a slot (unique-constrained for slot integrity, links to the resulting booking).
- `email_suppressions` — unsubscribe / bounce suppression list (compliance).
- `message_deliveries` — generic per-recipient/per-channel delivery + open/claim log powering analytics.

Note: **no device-token table** — that's push-only and excluded.

---

## 7. Email integration (the folded-in backlog item)

**Provider:** Resend — best developer experience and deliverability for our profile, and already assumed in the architecture doc.

**Cost:** **$0 to start** (3,000 emails/mo free), then **~$20/mo** for 50,000 emails — a tier that carries a long way. Cost scales gently with users; this is one of the cheapest parts of the stack.

**Tasks (Claude Code tickets):**
- [ ] Create Resend account + API key (free tier).
- [ ] Verify sending domain — SPF, DKIM, DMARC DNS records (≈15 min; Claude Code walks you through it).
- [ ] Build email templates: booking confirmation, booking reminder, flash-deal blast, admin announcement, win-back.
- [ ] Unsubscribe handling + suppression list (CAN-SPAM / GDPR — legally required).
- [ ] Webhook: Resend delivery/open events → `message_deliveries` (powers analytics).
- [ ] Move to the $20/mo Pro plan when monthly volume crosses ~3,000.

---

## 8. Explicitly excluded (push-to-phone dependent)

To keep this phase web-only and free of the mobile-app decision, the following are **deferred**:

- Native lock-screen push notifications to iPhone (require a mobile app or installed PWA).
- Reliable iOS push of any kind.
- Anything needing device push tokens or a mobile wrapper.

*Note:* Android/desktop **web** push is technically possible without an app, but we're excluding all true device push for now to keep scope clean. The whole engagement layer functions on **in-app + email**; native push becomes an optional enhancement to revisit alongside the mobile-app decision.

---

## 9. Design constraint — notification fatigue (applies throughout)

Every feature here competes for the same limited attention (against awards, The Lineup, reminders, deals). Treat restraint as a first-class design goal:
- Preferences + quiet hours are mandatory, not optional.
- Frequency caps on flash deals (per pro) and broadcasts (per audience).
- Sensible default cadence; consider a daily digest option for non-urgent items.
- De-duplicate across channels (don't in-app *and* email the same low-priority item unless the user opted in).

---

## 10. Cost summary

- **Email:** $0 → ~$20/mo for a long stretch.
- **In-app:** no new cost (reuses existing system).
- **Push infrastructure:** $0 — excluded.
- **Build cost:** low marginal effort — reuses the notification system and Fill My Chair; the new build is the email channel + the deal/broadcast/preferences logic.

---

## 11. How this slots into the master plan

This is **Batch 13 — Engagement**, layered on the existing sequence:
- **Phase A** is buildable in the prototype right now.
- **Phase B** (email) can begin right after **Batch 6 (auth)** — it's not blocked by payments.
- **Phase D** (flash deals) waits on **Batch 7 (booking)** and **Batch 8 (payments)** for deposits/discounts.
- The schema additions (Appendix A) fold into the Batch 5 schema file.

---

## Appendix A — Schema additions (validated SQL)

```sql
-- Engagement layer: notifications preferences, broadcasts, flash deals, email.
-- Append after the core StyleProfiles schema. No device-token table (push excluded).

create type broadcast_audience as enum ('all_pros','all_clients','everyone','segment');
create type message_channel    as enum ('in_app','email');
create type delivery_status    as enum ('queued','sent','delivered','opened','failed','claimed');
create type deal_status        as enum ('scheduled','live','closed','expired');

-- Per-user delivery preferences (one row per category).
create table public.notification_preferences (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  category    text not null,            -- 'deals','awards','lineup','reminders','announcements'
  in_app      boolean not null default true,
  email       boolean not null default true,
  quiet_start time,                     -- null = no quiet hours
  quiet_end   time,
  unique (profile_id, category)
);

-- Admin announcements.
create table public.broadcasts (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete set null,
  title        text not null,
  body         text not null,
  audience     broadcast_audience not null,
  segment_def  jsonb,                   -- optional segment filter when audience = 'segment'
  channels     message_channel[] not null default '{in_app}',
  scheduled_at timestamptz,             -- null = send immediately
  status       text not null default 'draft' check (status in ('draft','scheduled','sending','sent')),
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- Pro flash deals (evolution of chair_promotions).
create table public.flash_deals (
  id            uuid primary key default gen_random_uuid(),
  pro_id        uuid not null references public.pros(id) on delete cascade,
  service_id    uuid references public.services(id) on delete set null,
  title         text not null,
  deal_price    integer,                       -- set price in cents, or use discount_pct
  discount_pct  int check (discount_pct between 0 and 100),
  slots_total   int not null check (slots_total > 0),
  slots_claimed int not null default 0,
  starts_at     timestamptz not null default now(),
  expires_at    timestamptz not null,
  audience      text not null default 'loyalty',  -- 'waitlist'|'loyalty'|'followers'
  channels      message_channel[] not null default '{in_app,email}',
  status        deal_status not null default 'live',
  created_at    timestamptz not null default now()
);
create index on public.flash_deals (pro_id);
create index on public.flash_deals (status, expires_at);

create table public.flash_deal_claims (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references public.flash_deals(id) on delete cascade,
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  booking_id        uuid references public.bookings(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (deal_id, client_profile_id)        -- one claim per client per deal
);
create index on public.flash_deal_claims (deal_id);

-- Email unsubscribe / bounce suppression (compliance).
create table public.email_suppressions (
  id           uuid primary key default gen_random_uuid(),
  email        citext not null,
  category     text,                    -- null = suppress all
  reason       text,                    -- 'unsubscribe'|'bounce'|'complaint'
  created_at   timestamptz not null default now(),
  unique (email, category)
);

-- Generic per-recipient delivery log (powers analytics).
create table public.message_deliveries (
  id            uuid primary key default gen_random_uuid(),
  message_type  text not null,          -- 'broadcast'|'flash_deal'|'reminder'|'winback'
  source_id     uuid,                   -- broadcast_id / flash_deal_id / etc.
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  channel       message_channel not null,
  status        delivery_status not null default 'queued',
  sent_at       timestamptz,
  opened_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.message_deliveries (source_id);
create index on public.message_deliveries (recipient_id);

-- RLS
alter table public.notification_preferences enable row level security;
alter table public.broadcasts               enable row level security;
alter table public.flash_deals              enable row level security;
alter table public.flash_deal_claims        enable row level security;
alter table public.email_suppressions       enable row level security;
alter table public.message_deliveries       enable row level security;

create policy prefs_self on public.notification_preferences for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy broadcasts_admin on public.broadcasts for all
  using (public.is_admin()) with check (public.is_admin());

create policy deals_public_read on public.flash_deals for select using (true);
create policy deals_owner_write on public.flash_deals for all
  using (public.owns_pro(pro_id)) with check (public.owns_pro(pro_id));

create policy claims_party on public.flash_deal_claims for all
  using (client_profile_id = auth.uid()
         or exists (select 1 from public.flash_deals d where d.id = deal_id and public.owns_pro(d.pro_id))
         or public.is_admin())
  with check (client_profile_id = auth.uid());

create policy suppress_admin on public.email_suppressions for all
  using (public.is_admin()) with check (public.is_admin());

create policy deliveries_read on public.message_deliveries for select
  using (recipient_id = auth.uid() or public.is_admin());
```
