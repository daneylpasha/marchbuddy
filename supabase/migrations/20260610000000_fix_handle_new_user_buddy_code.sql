-- ============================================================================
-- Fix: Google sign-in (and any new signup) was failing with
--   "Database error saving new user#error=server_error"
--
-- Root cause:
--   Migration 20260525000000_buddy_codes_and_connections.sql added
--     alter column buddy_code set not null;
--   to public.profiles, but handle_new_user() (defined in supabase-schema.sql)
--   only inserts `(id)` and never sets buddy_code. So every fresh auth.users
--   insert triggered a NOT NULL violation, which aborted the auth user
--   creation entirely and surfaced to the client as server_error.
--
-- Fix:
--   Update handle_new_user() to generate and insert a unique buddy_code at
--   the same time. Retry on unique_violation in case of (very rare) collision.
--   After ~10 attempts fall back to a code with an extra suffix char, matching
--   the backfill loop's defensive behavior.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  attempt   int := 0;
begin
  loop
    attempt := attempt + 1;
    candidate := public.generate_buddy_code();

    begin
      insert into public.profiles (id, buddy_code)
      values (new.id, candidate);
      return new;
    exception when unique_violation then
      if attempt >= 10 then
        insert into public.profiles (id, buddy_code)
        values (
          new.id,
          substr(candidate, 1, 5)
            || substr(
                 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                 floor(random() * 31)::int + 1,
                 1
               )
        );
        return new;
      end if;
    end;
  end loop;
end;
$$;
