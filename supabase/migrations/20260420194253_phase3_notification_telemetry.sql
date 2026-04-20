-- ============================================================================
-- Phase 3: notification telemetry views.
--
-- These give us a quick read on whether the Phase-1/2/3 changes actually
-- reduced notification volume. Query them from Supabase Studio or a
-- scheduled alert — any user showing up in `notification_heavy_hitters`
-- should be investigated.
-- ============================================================================

-- 1. Per-user per-day notification volume (last 30 days) ---------------------
create or replace view public.notification_daily_volume as
select
  user_id,
  date_trunc('day', sent_at) as day,
  count(*)                   as total,
  count(*) filter (where type = 'A') as type_a,
  count(*) filter (where type = 'B') as type_b,
  count(*) filter (where type = 'C') as type_c,
  count(*) filter (where source = 'local') as from_local,
  count(*) filter (where source = 'push')  as from_push
from public.notification_log
where sent_at > now() - interval '30 days'
group by user_id, date_trunc('day', sent_at);

comment on view public.notification_daily_volume is
  'Per-user notification counts per day over the last 30 days, split by type and source.';

-- 2. Heavy hitters: any user who got > 2 notifications in a single day ------
-- in the last 7 days. These are the users at risk of uninstall due to
-- notification fatigue.
create or replace view public.notification_heavy_hitters as
select
  user_id,
  day,
  total,
  type_a,
  type_b,
  type_c,
  from_local,
  from_push
from public.notification_daily_volume
where total > 2 and day > now() - interval '7 days'
order by day desc, total desc;

comment on view public.notification_heavy_hitters is
  'Users who received more than 2 notifications in a single day over the last 7 days. Spot regressions in daily-cap enforcement.';
