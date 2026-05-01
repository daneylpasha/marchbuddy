-- Activates the daily re-engagement push notification cron job.
-- Requires pg_cron and pg_net extensions (enabled in Supabase by default).
-- Requires two vault secrets to be set in the Supabase dashboard:
--   name = 'SUPABASE_URL'      → your project URL (https://xxx.supabase.co)
--   name = 'SERVICE_ROLE_KEY'  → your project service_role key
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any stale copy of the job before (re-)creating it so this
-- migration is safe to re-run or roll forward from a failed state.
select cron.unschedule('daily-reengagement-push') where exists (
  select 1 from cron.job where jobname = 'daily-reengagement-push'
);

select cron.schedule(
  'daily-reengagement-push',
  '0 14 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL')
               || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY'
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);
