-- Enable Supabase Realtime for buddy_connections so clients can subscribe
-- to INSERT/UPDATE/DELETE events on their own connections.
--
-- Without this, postgres_changes subscriptions silently receive no events.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'buddy_connections'
  ) then
    alter publication supabase_realtime add table public.buddy_connections;
  end if;
end $$;
