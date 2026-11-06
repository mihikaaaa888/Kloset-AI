-- Automatic deletion of inactive accounts. Run once in the Supabase SQL Editor (safe to re-run), after schema.sql.
-- The daily job in server/accounts.mjs uses this: no activity for 3 years -> warning email -> deleted 30 days later.

alter table public.profiles
  add column if not exists last_active_at timestamptz,        -- set by the app each time it opens with a session
  add column if not exists inactivity_warned_at timestamptz;  -- set by the job when the warning email goes out

-- auth.users.last_sign_in_at alone isn't enough: someone who stays signed in and opens the app daily never "signs in".
-- Accounts with no profiles row are never returned, so they're kept rather than deleted unwarned.
create or replace function public.inactive_accounts(inactive_before timestamptz, warned_before timestamptz, max_rows int)
returns table (id uuid, email text, last_active timestamptz, warned_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select a.id, a.email, a.last_active, a.warned_at
  from (
    select u.id, u.email::text as email, p.inactivity_warned_at as warned_at,
           greatest(u.created_at, u.last_sign_in_at, p.last_active_at) as last_active
    from auth.users u
    join public.profiles p on p.id = u.id
  ) a
  where a.last_active < inactive_before
    -- Skip accounts already warned and still inside their 30 days.
    and (a.warned_at is null or a.warned_at <= a.last_active or a.warned_at <= warned_before)
  order by a.last_active
  limit max_rows;
$$;

-- This returns email addresses, so only the server's service role may call it.
revoke all on function public.inactive_accounts(timestamptz, timestamptz, int) from public, anon, authenticated;
grant execute on function public.inactive_accounts(timestamptz, timestamptz, int) to service_role;
