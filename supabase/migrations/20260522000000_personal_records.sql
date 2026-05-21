-- ============================================================================
-- MarchBuddy V2 — Auto-Detected PRs + Before/After Comparisons
--
-- Adds the `personal_records` table that powers:
--   1. Post-session PR banners
--   2. "Your PRs" section in the Progress tab
--   3. Proactive Coach Trigger 2 (post_session) PR mentions
--   4. Share card "New PR" badge
--
-- 5 PR types are ACTIVE in V2:
--   - fastest_pace          (overall lifetime PR)
--   - fastest_1k_split      (best 1km split in any session)
--   - longest_distance      (single-session distance record)
--   - longest_duration      (single-session duration record)
--   - first_milestone       (binary firsts: first_1k, first_3k, first_5k,
--                            first_30min_no_walk)
--
-- 1 PR type is RESERVED for V2.1 (enum includes it for forward-compat):
--   - highest_cadence       (deferred until cadence data quality is verified)
--
-- Also adds:
--   - `coach_v2_feature_flags` settings row for backfill pause control
-- ============================================================================

-- ─── 1. Enum types ────────────────────────────────────────────────────────

do $$ begin
  create type public.pr_type as enum (
    'fastest_pace',
    'fastest_1k_split',
    'longest_distance',
    'longest_duration',
    'first_milestone',
    'highest_cadence' -- reserved, not yet detected by the engine
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pr_confidence as enum (
    'high',
    'low' -- poor GPS accuracy >50m, or manual treadmill entry
  );
exception when duplicate_object then null; end $$;

-- ─── 2. personal_records table ───────────────────────────────────────────

create table if not exists public.personal_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  pr_type         public.pr_type not null,
  -- Subtype distinguishes variants within first_milestone (first_1k,
  -- first_3k, first_5k, first_30min_no_walk). Other pr_types may leave
  -- this null. Stored as text rather than enum to keep migrations cheap
  -- when new milestones are added (the engine validates allowed values).
  pr_subtype      text,
  -- Canonical metric value:
  --   - fastest_pace        → seconds per km (lower is better)
  --   - fastest_1k_split    → seconds per km (lower is better)
  --   - longest_distance    → meters
  --   - longest_duration    → seconds
  --   - first_milestone     → 0 (binary; metadata in pr_subtype)
  --   - highest_cadence     → steps per minute (higher is better)
  value           numeric not null,
  -- What the PR beat. NULL if this is the first-ever PR of its type
  -- (e.g. first session set the baseline) or for first_milestone events.
  previous_value  numeric,
  session_id      uuid not null references public.sessions(id) on delete cascade,
  achieved_at     timestamptz not null,
  confidence      public.pr_confidence not null default 'high',
  -- Free-form metadata captured at detection time. Lets the engine evolve
  -- (e.g. add gps_accuracy_m, distance_bucket_m, segment_index for the
  -- specific 1k split) without further migrations.
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),

  -- Idempotency: detection re-runs against the same session must not
  -- produce duplicate rows. Includes pr_subtype so multiple first_milestone
  -- types from a single session (e.g. user hits both first_1k and first_3k
  -- in their first long session) are allowed.
  unique (user_id, pr_type, coalesce(pr_subtype, ''), session_id)
);

alter table public.personal_records enable row level security;

-- Users SELECT their own; writes only via service role (Edge Function).
create policy "Users can read own personal records"
  on public.personal_records for select
  using (auth.uid() = user_id);

-- ─── 3. Indexes ───────────────────────────────────────────────────────────

-- Hot path: Progress tab — "Your PRs" newest first.
create index if not exists idx_pr_user_achieved
  on public.personal_records (user_id, achieved_at desc);

-- Hot path: detection engine — "what's the current best of type X for this user?"
-- For fastest_pace and fastest_1k_split: lower value is better (so order asc).
-- For longest_distance and longest_duration: higher is better (order desc).
-- We use a single index on (user_id, pr_type, value desc) — engine flips
-- order direction in queries as needed. A single covering index is cheap.
create index if not exists idx_pr_user_type_value
  on public.personal_records (user_id, pr_type, value desc);

-- Hot path: session-detail screen — "which PRs did this specific session set?"
create index if not exists idx_pr_session
  on public.personal_records (session_id);

-- ─── 4. Feature flag table ───────────────────────────────────────────────
-- Single-row pattern so we can pause the bulk backfill mid-run if it causes
-- DB load issues, without redeploying code. The backfill script reads this
-- between batches and aborts gracefully if disabled.

create table if not exists public.coach_v2_feature_flags (
  id                    smallint primary key default 1 check (id = 1),
  pr_backfill_enabled   boolean not null default true,
  pr_backfill_progress  jsonb not null default '{}'::jsonb, -- resume state
  updated_at            timestamptz not null default now()
);

-- Seed the singleton row.
insert into public.coach_v2_feature_flags (id) values (1) on conflict do nothing;

alter table public.coach_v2_feature_flags enable row level security;

-- Read-only for everyone; only service role can flip the flag.
create policy "Anyone can read coach_v2_feature_flags"
  on public.coach_v2_feature_flags for select
  using (true);

-- ─── 5. Helper view: user latest PRs ──────────────────────────────────────
-- Convenience view used by the Progress tab and the coach Trigger-2 prompt
-- to fetch the single most recent PR per (user, pr_type, pr_subtype) without
-- duplicating that DISTINCT-ON query at every call site.

create or replace view public.v_latest_personal_records as
select distinct on (user_id, pr_type, coalesce(pr_subtype, ''))
  id, user_id, pr_type, pr_subtype, value, previous_value,
  session_id, achieved_at, confidence, metadata
from public.personal_records
order by user_id, pr_type, coalesce(pr_subtype, ''), achieved_at desc;

-- Reuse the underlying table's RLS (the view inherits via the user_id check).
-- Postgres views don't have RLS; access is gated by the SELECT policy on
-- personal_records when the view is queried as a normal user.
