-- Kloset — security hardening. Run in the Supabase SQL Editor after the other files. Idempotent.

-- ── UPDATE policies: rows can't be handed to another user ─────────────────────
-- The originals had USING only, so a user could UPDATE ... SET user_id = <someone else>.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can update their own wardrobe items" on public.wardrobe_items;
create policy "Users can update their own wardrobe items"
  on public.wardrobe_items for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Only the intended columns are updatable ───────────────────────────────────
-- A recipient could previously rewrite a share's payload/message, or a request's sender.
revoke update on public.shares from authenticated;
grant update (seen_at) on public.shares to authenticated;

revoke update on public.friend_requests from authenticated;
grant update (status, responded_at) on public.friend_requests to authenticated;

-- profiles.email drives friend lookup; users must not be able to claim another address.
create or replace function public.keep_profile_email()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then new.email := old.email; end if;
  return new;
end;
$$;
drop trigger if exists keep_profile_email on public.profiles;
create trigger keep_profile_email before update on public.profiles
  for each row execute function public.keep_profile_email();

-- ── Storage: size and type limits enforced by Supabase itself ─────────────────
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('wardrobe-images', 'shared-images');
