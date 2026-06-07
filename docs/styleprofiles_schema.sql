-- ============================================================================
-- StyleProfiles — Supabase / Postgres schema  (Batch 5)
-- Foundation for: storefronts, group/household booking, memberships, loyalty,
-- reviews, tag & consent, Fill My Chair, monthly awards, the self-care
-- marketplace, moderation, notifications, feature flags — plus THE LINEUP
-- (season bracket competition) folded in.
--
-- Conventions
--   * UUID primary keys (gen_random_uuid()).
--   * Money stored as integer cents (e.g. 4500 = $45.00). Never floats/numeric — avoids rounding errors in deposits, splits, and payouts.
--   * Every table has RLS enabled. Policies favor: public read for storefront/
--     catalog/competition data, owner-write for pros, self-scope for clients,
--     and full access for admins via public.is_admin().
--   * Run top-to-bottom. Safe to split into ordered migrations later.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";      -- case-insensitive text (emails)

-- ----------------------------------------------------------------------------
-- 0. Helper functions & shared trigger
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- NOTE: role/ownership helper functions (has_role, is_admin, owns_pro) are
-- defined later — after their referenced tables exist — just before the RLS
-- policies that use them (Postgres validates SQL function bodies at creation).

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------

create type booking_status     as enum ('pending','confirmed','completed','cancelled','no_show');
create type membership_status  as enum ('active','past_due','cancelled');
create type consent_status     as enum ('pending','public','private','anonymous','declined');
create type promo_type         as enum ('last_minute','cancellation','slow_day');
create type promo_status       as enum ('open','claimed','expired');
create type order_status        as enum ('pending','paid','fulfilled','cancelled','refunded');
create type report_status       as enum ('open','resolved','dismissed');
create type report_severity     as enum ('low','med','high');
create type award_sub_status    as enum ('pending','approved','removed');

-- The Lineup
create type competition_status  as enum ('draft','qualifying','live','complete');
create type round_status        as enum ('pending','live','complete');
create type contestant_status   as enum ('active','eliminated','redeemed','champion');
create type matchup_status      as enum ('pending','live','complete');
create type entry_status        as enum ('draft','submitted','approved','removed');
create type vote_type           as enum ('redemption','fan_favorite','cut_of_week');
create type window_status       as enum ('scheduled','open','closed');

-- ----------------------------------------------------------------------------
-- 2. Identity, roles & households
-- ----------------------------------------------------------------------------

-- One row per auth user. Mirrors auth.users; app-level profile data lives here.
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  email         citext,
  avatar_color  text,
  style_points  integer not null default 0,   -- denormalized loyalty balance (ledger below)
  loyalty_tier  text not null default 'Bronze',
  city          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.user_roles (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  role     text not null check (role in ('client','pro','judge','admin')),
  primary key (user_id, role)
);

-- Beauty/grooming categories used by storefronts and monthly awards.
create table public.service_categories (
  slug    text primary key,            -- 'barber','stylist','braider', ...
  label   text not null,
  color   text,
  active  boolean not null default true,
  sort    int not null default 0
);

-- A professional storefront (a profile may own one).
create table public.pros (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  handle        text unique not null,
  display_name  text not null,
  category      text not null references public.service_categories(slug),
  bio           text,
  city          text,
  verified      boolean not null default false,
  rating_avg    numeric(3,2) not null default 0,
  rating_count  integer not null default 0,
  price_from    integer,
  latitude      double precision,            -- geocoded from address (Batch 7 / engagement geo)
  longitude     double precision,
  travel_mode   text not null default 'shop' check (travel_mode in ('shop','mobile','both')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.pros (category);
create index on public.pros (profile_id);

-- Household: a primary account holder plus dependents/linked adults (Batch 1).
create table public.households (
  id                 uuid primary key default gen_random_uuid(),
  primary_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at         timestamptz not null default now()
);
create index on public.households (primary_profile_id);

create table public.household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete set null, -- null for dependents w/o login
  display_name  text not null,
  member_type   text not null default 'adult' check (member_type in ('primary','adult','child')),
  birth_year    int,
  avatar_color  text,
  created_at    timestamptz not null default now()
);
create index on public.household_members (household_id);

-- ----------------------------------------------------------------------------
-- 3. Services & add-ons
-- ----------------------------------------------------------------------------

create table public.services (
  id           uuid primary key default gen_random_uuid(),
  pro_id       uuid not null references public.pros(id) on delete cascade,
  name         text not null,
  duration_min int not null check (duration_min >= 0),
  price        integer not null check (price >= 0),
  deposit      integer not null default 0 check (deposit >= 0),
  is_addon     boolean not null default false,   -- "frequently added" upsell items
  active       boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index on public.services (pro_id);

-- ----------------------------------------------------------------------------
-- 4. Memberships (pro-defined tiers + client subscriptions)
-- ----------------------------------------------------------------------------

create table public.membership_tiers (
  id          uuid primary key default gen_random_uuid(),
  pro_id      uuid not null references public.pros(id) on delete cascade,
  name        text not null,
  price       integer not null check (price >= 0),  -- per month
  includes    text,                                       -- e.g. "2 cuts / month"
  perks       text[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.membership_tiers (pro_id);

create table public.memberships (
  id                   uuid primary key default gen_random_uuid(),
  tier_id              uuid not null references public.membership_tiers(id) on delete restrict,
  member_profile_id    uuid not null references public.profiles(id) on delete cascade,
  status               membership_status not null default 'active',
  stripe_subscription_id text,
  started_at           timestamptz not null default now(),
  current_period_end   timestamptz,
  cancelled_at         timestamptz,
  unique (tier_id, member_profile_id)
);
create index on public.memberships (member_profile_id);

-- ----------------------------------------------------------------------------
-- 5. Bookings (parent appointment + per-person line items) — Batch 1/2
-- ----------------------------------------------------------------------------

create table public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  client_profile_id  uuid not null references public.profiles(id) on delete cascade,
  pro_id             uuid not null references public.pros(id) on delete restrict,
  household_id       uuid references public.households(id) on delete set null,
  status             booking_status not null default 'pending',
  service_date       date not null,
  start_time         timestamptz,
  service_total      integer not null default 0,
  deposit_total      integer not null default 0,
  points_earned      integer not null default 0,
  membership_tier_id uuid references public.membership_tiers(id) on delete set null, -- joined at checkout
  stripe_payment_intent_id text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.bookings (client_profile_id);
create index on public.bookings (pro_id);
create index on public.bookings (service_date);

create table public.booking_line_items (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings(id) on delete cascade,
  household_member_id uuid references public.household_members(id) on delete set null,
  service_id          uuid references public.services(id) on delete set null,
  service_name        text not null,        -- snapshot at booking time
  is_addon            boolean not null default false,
  price               integer not null default 0,
  deposit             integer not null default 0,
  duration_min        int not null default 0,
  scheduled_at        timestamptz,          -- computed back-to-back slot
  sort                int not null default 0
);
create index on public.booking_line_items (booking_id);

-- ----------------------------------------------------------------------------
-- 6. Loyalty (StylePoints ledger + rewards)
-- ----------------------------------------------------------------------------

create table public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  delta       integer not null,             -- +earn / -redeem
  reason      text not null,
  booking_id  uuid references public.bookings(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.loyalty_transactions (profile_id);

create table public.rewards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  cost_points integer not null check (cost_points >= 0),
  active      boolean not null default true
);

create table public.reward_redemptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  reward_id   uuid not null references public.rewards(id) on delete restrict,
  cost_points integer not null,
  created_at  timestamptz not null default now()
);
create index on public.reward_redemptions (profile_id);

-- ----------------------------------------------------------------------------
-- 7. Reviews & reputation
-- ----------------------------------------------------------------------------

create table public.reviews (
  id                uuid primary key default gen_random_uuid(),
  pro_id            uuid not null references public.pros(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  booking_id        uuid references public.bookings(id) on delete set null,
  rating            int not null check (rating between 1 and 5),
  body              text,
  tags              text[] not null default '{}',
  verified          boolean not null default false,    -- true when tied to a completed booking
  created_at        timestamptz not null default now(),
  unique (booking_id, author_profile_id)
);
create index on public.reviews (pro_id);

create table public.review_responses (
  review_id  uuid primary key references public.reviews(id) on delete cascade,
  pro_id     uuid not null references public.pros(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. Tag & consent (model/client media releases) — reused by The Lineup
-- ----------------------------------------------------------------------------

create table public.consent_requests (
  id                  uuid primary key default gen_random_uuid(),
  pro_id              uuid not null references public.pros(id) on delete cascade,
  subject_profile_id  uuid not null references public.profiles(id) on delete cascade,
  look_label          text,
  for_contest         boolean not null default false,
  status              consent_status not null default 'pending',
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);
create index on public.consent_requests (subject_profile_id);
create index on public.consent_requests (pro_id);

-- ----------------------------------------------------------------------------
-- 9. Fill My Chair (promotional open slots)
-- ----------------------------------------------------------------------------

create table public.chair_promotions (
  id                 uuid primary key default gen_random_uuid(),
  pro_id             uuid not null references public.pros(id) on delete cascade,
  service_id         uuid references public.services(id) on delete set null,
  slot_label         text,                       -- "Today", "This Saturday"
  slot_time          text,                       -- "3:00 PM"
  promo_type         promo_type not null default 'last_minute',
  discount_pct       int not null default 0 check (discount_pct between 0 and 100),
  audience           text not null default 'loyalty',  -- 'waitlist'|'loyalty'|'followers'
  notified_count     int not null default 0,
  status             promo_status not null default 'open',
  claimed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index on public.chair_promotions (pro_id);

-- ----------------------------------------------------------------------------
-- 10. Self-care marketplace (first-party) — Batch 4
-- ----------------------------------------------------------------------------

create table public.product_categories (
  slug   text primary key,
  label  text not null,
  color  text,
  sort   int not null default 0
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  brand           text,
  category        text references public.product_categories(slug),
  price           integer not null check (price >= 0),
  blurb           text,
  used_by_pro_id  uuid references public.pros(id) on delete set null, -- "used by" tie-in
  is_available    boolean not null default true,
  inventory_qty   int,                          -- null = not stock-tracked yet
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.products (category);

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  buyer_profile_id   uuid not null references public.profiles(id) on delete cascade,
  status             order_status not null default 'pending',
  subtotal           integer not null default 0,
  shipping           integer not null default 0,
  total              integer not null default 0,
  stripe_payment_intent_id text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.orders (buyer_profile_id);

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete restrict,
  product_name text not null,                   -- snapshot
  unit_price  integer not null,
  qty         int not null check (qty > 0)
);
create index on public.order_items (order_id);

-- ----------------------------------------------------------------------------
-- 11. Monthly Awards
-- ----------------------------------------------------------------------------

create table public.award_cycles (
  id         uuid primary key default gen_random_uuid(),
  period     date not null,                      -- first day of the month
  opens_at   timestamptz not null,
  closes_at  timestamptz not null,
  status     text not null default 'voting' check (status in ('submissions','voting','review','complete')),
  unique (period)
);

create table public.award_submissions (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references public.award_cycles(id) on delete cascade,
  category    text not null references public.service_categories(slug),
  pro_id      uuid not null references public.pros(id) on delete cascade,
  look_label  text,
  media_path  text,                              -- Supabase Storage path
  status      award_sub_status not null default 'pending',
  flag_reason text,
  created_at  timestamptz not null default now(),
  unique (cycle_id, category, pro_id)            -- one entry per pro per category per cycle
);
create index on public.award_submissions (cycle_id, category);

create table public.award_votes (
  id               uuid primary key default gen_random_uuid(),
  cycle_id         uuid not null references public.award_cycles(id) on delete cascade,
  category         text not null references public.service_categories(slug),
  submission_id    uuid not null references public.award_submissions(id) on delete cascade,
  voter_profile_id uuid not null references public.profiles(id) on delete cascade,
  weight           numeric not null default 1,
  created_at       timestamptz not null default now(),
  unique (cycle_id, category, voter_profile_id)  -- one vote per category per cycle
);
create index on public.award_votes (submission_id);

create table public.award_winners (
  cycle_id    uuid not null references public.award_cycles(id) on delete cascade,
  category    text not null references public.service_categories(slug),
  pro_id      uuid not null references public.pros(id) on delete restrict,
  selected_at timestamptz not null default now(),
  primary key (cycle_id, category)
);

-- ----------------------------------------------------------------------------
-- 12. THE LINEUP — season bracket competition (folded in per build plan)
-- ----------------------------------------------------------------------------

create table public.competitions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  scope      text not null default 'city' check (scope in ('city','regional','national')),
  metro      text,
  status     competition_status not null default 'draft',
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);

create table public.competition_rounds (
  id                uuid primary key default gen_random_uuid(),
  competition_id    uuid not null references public.competitions(id) on delete cascade,
  name              text not null,               -- 'Quarterfinal'|'Semifinal'|'Final'|'Redemption'
  round_order       int not null,
  time_limit_minutes int,
  status            round_status not null default 'pending',
  starts_at         timestamptz
);
create index on public.competition_rounds (competition_id);

create table public.contestants (
  id                  uuid primary key default gen_random_uuid(),
  competition_id      uuid not null references public.competitions(id) on delete cascade,
  pro_id              uuid not null references public.pros(id) on delete cascade,
  seed                int,
  qualification_source text not null default 'ranking' check (qualification_source in ('ranking','open_call')),
  status              contestant_status not null default 'active',
  unique (competition_id, pro_id)
);
create index on public.contestants (competition_id);

create table public.matchups (
  id                   uuid primary key default gen_random_uuid(),
  round_id             uuid not null references public.competition_rounds(id) on delete cascade,
  contestant_a         uuid references public.contestants(id) on delete set null,
  contestant_b         uuid references public.contestants(id) on delete set null,
  scheduled_at         timestamptz,
  winner_contestant_id uuid references public.contestants(id) on delete set null,
  status               matchup_status not null default 'pending'
);
create index on public.matchups (round_id);

create table public.briefs (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete cascade, -- null = reusable / Cut of the Week
  title          text not null,
  description    text,
  constraints    text,
  created_at     timestamptz not null default now()
);

create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  contestant_id uuid not null references public.contestants(id) on delete cascade,
  matchup_id    uuid references public.matchups(id) on delete set null,
  brief_id      uuid references public.briefs(id) on delete set null,
  client_id     uuid references public.profiles(id) on delete set null,   -- the person in the chair
  consent_id    uuid references public.consent_requests(id) on delete set null,
  before_media  text,                              -- Supabase Storage path
  after_media   text,
  status        entry_status not null default 'draft',
  created_at    timestamptz not null default now()
);
create index on public.entries (contestant_id);
create index on public.entries (matchup_id);

create table public.judges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  bio          text,
  unique (user_id)
);

create table public.matchup_judges (      -- which judges are assigned to which matchups
  matchup_id uuid not null references public.matchups(id) on delete cascade,
  judge_id   uuid not null references public.judges(id) on delete cascade,
  primary key (matchup_id, judge_id)
);

create table public.scores (
  id               uuid primary key default gen_random_uuid(),
  entry_id         uuid not null references public.entries(id) on delete cascade,
  judge_id         uuid not null references public.judges(id) on delete cascade,
  technical        numeric not null default 0,    -- weight 30%
  creative         numeric not null default 0,    -- 25%
  reveal           numeric not null default 0,    -- 20%
  client_experience numeric not null default 0,   -- 15%
  composure        numeric not null default 0,    -- 10%
  total            numeric,                        -- computed in app/edge fn
  notes            text,
  created_at       timestamptz not null default now(),
  unique (entry_id, judge_id)
);
create index on public.scores (entry_id);

create table public.voting_windows (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete cascade,
  vote_type      vote_type not null,
  opens_at       timestamptz not null,
  closes_at      timestamptz not null,
  status         window_status not null default 'scheduled'
);
create index on public.voting_windows (competition_id);

create table public.fan_votes (
  id                   uuid primary key default gen_random_uuid(),
  voting_window_id     uuid not null references public.voting_windows(id) on delete cascade,
  voter_user_id        uuid not null references public.profiles(id) on delete cascade,
  target_contestant_id uuid references public.contestants(id) on delete cascade,
  target_entry_id      uuid references public.entries(id) on delete cascade,
  metro                text,
  weight               numeric not null default 1,
  created_at           timestamptz not null default now(),
  unique (voting_window_id, voter_user_id)         -- one vote per window
);
create index on public.fan_votes (voting_window_id);

create table public.weekly_challenges (    -- Cut of the Week, year-round
  id         uuid primary key default gen_random_uuid(),
  brief_id   uuid not null references public.briefs(id) on delete restrict,
  opens_at   timestamptz not null,
  closes_at  timestamptz not null,
  status     window_status not null default 'scheduled'
);

create table public.events (               -- live competition events
  id                uuid primary key default gen_random_uuid(),
  competition_id    uuid references public.competitions(id) on delete cascade,
  venue             text,
  address           text,
  event_date        timestamptz,
  ticketing_provider text default 'posh_vip' check (ticketing_provider in ('stripe','posh_vip'))
);

-- ----------------------------------------------------------------------------
-- 13. Moderation (reports + vote anomaly flags)
-- ----------------------------------------------------------------------------

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,            -- 'Portfolio post','Review','Profile bio', ...
  subject_handle text,
  reason        text not null,
  severity      report_severity not null default 'low',
  status        report_status not null default 'open',
  reporter_profile_id uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create table public.vote_flags (
  id            uuid primary key default gen_random_uuid(),
  context       text not null,            -- 'awards' | 'lineup'
  category      text,
  pro_id        uuid references public.pros(id) on delete set null,
  note          text,
  vote_count    int,
  status        text not null default 'open' check (status in ('open','voided','cleared')),
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 14. Notifications
-- ----------------------------------------------------------------------------

create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  kind                text,               -- 'tag','points','awards','booking','review','chair', ...
  body                text not null,
  link_screen         text,
  feature             text,               -- e.g. 'lineup' (gate by feature flag)
  read                boolean not null default false,
  created_at          timestamptz not null default now()
);
create index on public.notifications (recipient_profile_id, read);

-- ----------------------------------------------------------------------------
-- 15. Platform settings (feature flags — the on/off toggles)
-- ----------------------------------------------------------------------------

create table public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value) values
  ('marketplace_on', 'false'::jsonb),
  ('lineup_on',      'false'::jsonb),
  ('awards_on',      'true'::jsonb)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 16. updated_at triggers
-- ----------------------------------------------------------------------------

create trigger t_profiles_updated      before update on public.profiles        for each row execute function public.set_updated_at();
create trigger t_pros_updated          before update on public.pros            for each row execute function public.set_updated_at();
create trigger t_tiers_updated         before update on public.membership_tiers for each row execute function public.set_updated_at();
create trigger t_bookings_updated      before update on public.bookings        for each row execute function public.set_updated_at();
create trigger t_products_updated      before update on public.products        for each row execute function public.set_updated_at();
create trigger t_orders_updated        before update on public.orders          for each row execute function public.set_updated_at();
create trigger t_settings_updated      before update on public.platform_settings for each row execute function public.set_updated_at();

-- ============================================================================
-- 17. Row Level Security
-- ============================================================================
-- Role/ownership helpers (defined here, after their referenced tables exist).

create or replace function public.has_role(_role text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('admin');
$$;

create or replace function public.owns_pro(_pro_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pros p
    where p.id = _pro_id and p.profile_id = auth.uid()
  );
$$;

-- Enable RLS on everything, then add policies. Default-deny once enabled.

alter table public.profiles            enable row level security;
alter table public.user_roles          enable row level security;
alter table public.service_categories  enable row level security;
alter table public.pros                enable row level security;
alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.services            enable row level security;
alter table public.membership_tiers    enable row level security;
alter table public.memberships         enable row level security;
alter table public.bookings            enable row level security;
alter table public.booking_line_items  enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.rewards             enable row level security;
alter table public.reward_redemptions  enable row level security;
alter table public.reviews             enable row level security;
alter table public.review_responses    enable row level security;
alter table public.consent_requests    enable row level security;
alter table public.chair_promotions    enable row level security;
alter table public.product_categories  enable row level security;
alter table public.products            enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.award_cycles        enable row level security;
alter table public.award_submissions   enable row level security;
alter table public.award_votes         enable row level security;
alter table public.award_winners       enable row level security;
alter table public.competitions        enable row level security;
alter table public.competition_rounds  enable row level security;
alter table public.contestants         enable row level security;
alter table public.matchups            enable row level security;
alter table public.briefs              enable row level security;
alter table public.entries             enable row level security;
alter table public.judges              enable row level security;
alter table public.matchup_judges      enable row level security;
alter table public.scores              enable row level security;
alter table public.voting_windows      enable row level security;
alter table public.fan_votes           enable row level security;
alter table public.weekly_challenges   enable row level security;
alter table public.events              enable row level security;
alter table public.reports             enable row level security;
alter table public.vote_flags          enable row level security;
alter table public.notifications       enable row level security;
alter table public.platform_settings   enable row level security;

-- ---- Identity ----
create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_write  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all   on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy roles_self_read on public.user_roles for select using (user_id = auth.uid() or public.is_admin());
create policy roles_admin_all on public.user_roles for all using (public.is_admin()) with check (public.is_admin());

-- ---- Public-read reference & storefront data ----
create policy cats_public_read on public.service_categories for select using (true);
create policy cats_admin_write on public.service_categories for all using (public.is_admin()) with check (public.is_admin());

create policy pros_public_read on public.pros for select using (true);
create policy pros_owner_write on public.pros for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy pros_owner_insert on public.pros for insert with check (profile_id = auth.uid());
create policy pros_admin_all on public.pros for all using (public.is_admin()) with check (public.is_admin());

create policy services_public_read on public.services for select using (true);
create policy services_owner_write on public.services for all using (public.owns_pro(pro_id)) with check (public.owns_pro(pro_id));

create policy tiers_public_read on public.membership_tiers for select using (true);
create policy tiers_owner_write on public.membership_tiers for all using (public.owns_pro(pro_id)) with check (public.owns_pro(pro_id));

-- ---- Households (primary holder scope) ----
create policy households_owner on public.households for all
  using (primary_profile_id = auth.uid() or public.is_admin())
  with check (primary_profile_id = auth.uid());

create policy hh_members_owner on public.household_members for all
  using (exists (select 1 from public.households h where h.id = household_id and h.primary_profile_id = auth.uid()) or public.is_admin())
  with check (exists (select 1 from public.households h where h.id = household_id and h.primary_profile_id = auth.uid()));

-- ---- Memberships ----
create policy memberships_member_read on public.memberships for select
  using (member_profile_id = auth.uid()
         or exists (select 1 from public.membership_tiers t where t.id = tier_id and public.owns_pro(t.pro_id))
         or public.is_admin());
create policy memberships_member_write on public.memberships for insert with check (member_profile_id = auth.uid());
create policy memberships_member_update on public.memberships for update using (member_profile_id = auth.uid());

-- ---- Bookings ----
create policy bookings_party_read on public.bookings for select
  using (client_profile_id = auth.uid() or public.owns_pro(pro_id) or public.is_admin());
create policy bookings_client_write on public.bookings for insert with check (client_profile_id = auth.uid());
create policy bookings_party_update on public.bookings for update
  using (client_profile_id = auth.uid() or public.owns_pro(pro_id));

create policy bli_party_access on public.booking_line_items for all
  using (exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.client_profile_id = auth.uid() or public.owns_pro(b.pro_id) or public.is_admin())))
  with check (exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.client_profile_id = auth.uid() or public.owns_pro(b.pro_id))));

-- ---- Loyalty ----
create policy loyalty_self_read on public.loyalty_transactions for select using (profile_id = auth.uid() or public.is_admin());
create policy rewards_public_read on public.rewards for select using (true);
create policy rewards_admin_write on public.rewards for all using (public.is_admin()) with check (public.is_admin());
create policy redemptions_self on public.reward_redemptions for all using (profile_id = auth.uid() or public.is_admin()) with check (profile_id = auth.uid());

-- ---- Reviews ----
create policy reviews_public_read on public.reviews for select using (true);
create policy reviews_author_write on public.reviews for insert with check (author_profile_id = auth.uid());
create policy reviews_author_update on public.reviews for update using (author_profile_id = auth.uid());
create policy review_resp_public_read on public.review_responses for select using (true);
create policy review_resp_owner_write on public.review_responses for all using (public.owns_pro(pro_id)) with check (public.owns_pro(pro_id));

-- ---- Consent (subject and requesting pro) ----
create policy consent_party_read on public.consent_requests for select
  using (subject_profile_id = auth.uid() or public.owns_pro(pro_id) or public.is_admin());
create policy consent_pro_insert on public.consent_requests for insert with check (public.owns_pro(pro_id));
create policy consent_subject_update on public.consent_requests for update using (subject_profile_id = auth.uid());

-- ---- Fill My Chair ----
create policy chair_public_read on public.chair_promotions for select using (true);
create policy chair_owner_write on public.chair_promotions for all using (public.owns_pro(pro_id)) with check (public.owns_pro(pro_id));

-- ---- Marketplace ----
create policy prodcats_public_read on public.product_categories for select using (true);
create policy prodcats_admin_write on public.product_categories for all using (public.is_admin()) with check (public.is_admin());
create policy products_public_read on public.products for select using (is_available or public.is_admin());
create policy products_admin_write on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy orders_buyer on public.orders for all using (buyer_profile_id = auth.uid() or public.is_admin()) with check (buyer_profile_id = auth.uid());
create policy order_items_buyer on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_profile_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.orders o where o.id = order_id and o.buyer_profile_id = auth.uid()));

-- ---- Monthly Awards ----
create policy cycles_public_read on public.award_cycles for select using (true);
create policy cycles_admin_write on public.award_cycles for all using (public.is_admin()) with check (public.is_admin());
create policy awardsub_public_read on public.award_submissions for select using (status = 'approved' or public.owns_pro(pro_id) or public.is_admin());
create policy awardsub_owner_write on public.award_submissions for insert with check (public.owns_pro(pro_id));
create policy awardsub_admin_update on public.award_submissions for update using (public.is_admin() or public.owns_pro(pro_id));
create policy awardvotes_self on public.award_votes for select using (voter_profile_id = auth.uid() or public.is_admin());
create policy awardvotes_insert on public.award_votes for insert with check (voter_profile_id = auth.uid());
create policy awardwin_public_read on public.award_winners for select using (true);
create policy awardwin_admin_write on public.award_winners for all using (public.is_admin()) with check (public.is_admin());

-- ---- The Lineup (public bracket; admin/contestant/judge writes) ----
create policy comp_public_read on public.competitions for select using (true);
create policy comp_admin_write on public.competitions for all using (public.is_admin()) with check (public.is_admin());
create policy rounds_public_read on public.competition_rounds for select using (true);
create policy rounds_admin_write on public.competition_rounds for all using (public.is_admin()) with check (public.is_admin());
create policy contestants_public_read on public.contestants for select using (true);
create policy contestants_self_update on public.contestants for update using (public.owns_pro(pro_id) or public.is_admin());
create policy contestants_admin_write on public.contestants for all using (public.is_admin()) with check (public.is_admin());
create policy matchups_public_read on public.matchups for select using (true);
create policy matchups_admin_write on public.matchups for all using (public.is_admin()) with check (public.is_admin());
create policy briefs_public_read on public.briefs for select using (true);
create policy briefs_admin_write on public.briefs for all using (public.is_admin()) with check (public.is_admin());

create policy entries_read on public.entries for select
  using (status = 'approved' or public.is_admin()
         or exists (select 1 from public.contestants c where c.id = contestant_id and public.owns_pro(c.pro_id)));
create policy entries_owner_write on public.entries for all
  using (exists (select 1 from public.contestants c where c.id = contestant_id and public.owns_pro(c.pro_id)) or public.is_admin())
  with check (exists (select 1 from public.contestants c where c.id = contestant_id and public.owns_pro(c.pro_id)) or public.is_admin());

create policy judges_public_read on public.judges for select using (true);
create policy judges_admin_write on public.judges for all using (public.is_admin()) with check (public.is_admin());
create policy mjudges_admin on public.matchup_judges for all using (public.is_admin()) with check (public.is_admin());

-- Judges may insert/update scores only for matchups they're assigned to.
create policy scores_read on public.scores for select using (public.is_admin()
  or exists (select 1 from public.judges j where j.id = judge_id and j.user_id = auth.uid()));
create policy scores_judge_write on public.scores for all
  using (exists (select 1 from public.judges j where j.id = judge_id and j.user_id = auth.uid()))
  with check (exists (
     select 1
     from public.judges j
     join public.entries e on e.id = entry_id
     join public.matchup_judges mj on mj.judge_id = j.id and mj.matchup_id = e.matchup_id
     where j.id = judge_id and j.user_id = auth.uid()
  ));

create policy vwindows_public_read on public.voting_windows for select using (true);
create policy vwindows_admin_write on public.voting_windows for all using (public.is_admin()) with check (public.is_admin());

-- Fans insert their own vote only while the window is open; read own; admin reads all.
create policy fanvotes_self_read on public.fan_votes for select using (voter_user_id = auth.uid() or public.is_admin());
create policy fanvotes_insert on public.fan_votes for insert
  with check (voter_user_id = auth.uid()
    and exists (select 1 from public.voting_windows w
                where w.id = voting_window_id and w.status = 'open' and now() between w.opens_at and w.closes_at));

create policy weekly_public_read on public.weekly_challenges for select using (true);
create policy weekly_admin_write on public.weekly_challenges for all using (public.is_admin()) with check (public.is_admin());
create policy events_public_read on public.events for select using (true);
create policy events_admin_write on public.events for all using (public.is_admin()) with check (public.is_admin());

-- ---- Moderation ----
create policy reports_insert on public.reports for insert with check (reporter_profile_id = auth.uid() or reporter_profile_id is null);
create policy reports_admin_read on public.reports for select using (public.is_admin());
create policy reports_admin_write on public.reports for update using (public.is_admin());
create policy voteflags_admin on public.vote_flags for all using (public.is_admin()) with check (public.is_admin());

-- ---- Notifications ----
create policy notif_self_read on public.notifications for select using (recipient_profile_id = auth.uid());
create policy notif_self_update on public.notifications for update using (recipient_profile_id = auth.uid());
create policy notif_admin_all on public.notifications for all using (public.is_admin()) with check (public.is_admin());

-- ---- Platform settings (anyone signed-in can read flags; only admin writes) ----
create policy settings_read on public.platform_settings for select using (true);
create policy settings_admin_write on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 18. Seed reference data (beauty categories + product categories)
-- ----------------------------------------------------------------------------

insert into public.service_categories (slug, label, color, sort) values
  ('barber','Barber','#F4A93C',1),
  ('stylist','Stylist','#FF6FA5',2),
  ('braider','Braider','#A78BFA',3),
  ('loctician','Loctician','#2DD4BF',4),
  ('nail','Nail Tech','#F472D0',5),
  ('lash','Lash Tech','#56C2FF',6),
  ('makeup','Makeup','#FF8A5B',7),
  ('colorist','Colorist','#34D399',8)
on conflict (slug) do nothing;

insert into public.product_categories (slug, label, color, sort) values
  ('hair','Hair','#FF6FA5',1),
  ('beard','Beard & Shave','#F4A93C',2),
  ('skin','Skin','#34D399',3),
  ('nails','Nails','#F472D0',4),
  ('tools','Tools','#56C2FF',5)
on conflict (slug) do nothing;

-- ============================================================================
-- End of schema.
-- ============================================================================
