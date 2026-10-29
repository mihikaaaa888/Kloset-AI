-- Kloset — Friends & sharing
-- Run this entire file in the Supabase SQL Editor after schema.sql.
-- Idempotent (safe to re-run).

-- ── profiles.email ────────────────────────────────────────────────────────────
-- Friends are found by email. Profiles stay private (own-row RLS); lookups go
-- through the security-definer functions below, which only ever return
-- id + name + email for a single exact match or for existing connections.

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id and (p.email is null or p.email <> lower(u.email));

create unique index if not exists profiles_email_idx on public.profiles(email);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- ── friend_requests ───────────────────────────────────────────────────────────
-- One row per pair of users. status: pending → accepted | declined.
-- An accepted row *is* the friendship.

create table if not exists public.friend_requests (
  id            uuid primary key default uuid_generate_v4(),
  sender_id     uuid not null references auth.users(id) on delete cascade,
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (sender_id <> recipient_id)
);

-- At most one row per unordered pair
create unique index if not exists friend_requests_pair_idx
  on public.friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id));
create index if not exists friend_requests_recipient_idx on public.friend_requests(recipient_id);

alter table public.friend_requests enable row level security;

drop policy if exists "See own friend requests" on public.friend_requests;
create policy "See own friend requests"
  on public.friend_requests for select
  using (auth.uid() in (sender_id, recipient_id));

drop policy if exists "Send friend requests" on public.friend_requests;
create policy "Send friend requests"
  on public.friend_requests for insert
  with check (auth.uid() = sender_id and status = 'pending');

-- Only the recipient answers a request
drop policy if exists "Answer friend requests" on public.friend_requests;
create policy "Answer friend requests"
  on public.friend_requests for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id and status in ('accepted', 'declined'));

-- Either side can cancel a request or unfriend
drop policy if exists "Remove friend requests" on public.friend_requests;
create policy "Remove friend requests"
  on public.friend_requests for delete
  using (auth.uid() in (sender_id, recipient_id));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted'
      and least(sender_id, recipient_id) = least(a, b)
      and greatest(sender_id, recipient_id) = greatest(a, b)
  );
$$;

-- Exact-email lookup used by "Add friend". Never lists users.
create or replace function public.find_user_by_email(p_email text)
returns table (id uuid, name text, email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.email
  from public.profiles p
  where p.email = lower(trim(p_email))
    and p.id <> auth.uid()
  limit 1;
$$;

-- Every request/friendship involving the caller, with the other person's name.
create or replace function public.list_connections()
returns table (
  id uuid,
  status text,
  direction text,
  other_id uuid,
  other_name text,
  other_email text,
  created_at timestamptz,
  responded_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    fr.id,
    fr.status,
    case when fr.sender_id = auth.uid() then 'outgoing' else 'incoming' end,
    p.id,
    p.name,
    p.email,
    fr.created_at,
    fr.responded_at
  from public.friend_requests fr
  join public.profiles p
    on p.id = case when fr.sender_id = auth.uid() then fr.recipient_id else fr.sender_id end
  where auth.uid() in (fr.sender_id, fr.recipient_id)
  order by fr.created_at desc;
$$;

-- ── shares ────────────────────────────────────────────────────────────────────
-- A piece or outfit sent to a friend. `payload` is a snapshot taken at send
-- time (item fields + storage paths for photos), so it stays viewable even if
-- the sender later edits or deletes the original.

create table if not exists public.shares (
  id            uuid primary key default uuid_generate_v4(),
  sender_id     uuid not null references auth.users(id) on delete cascade,
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  bundle_id     uuid not null,          -- shared by every copy of one send; photo folder
  kind          text not null check (kind in ('item', 'outfit')),
  payload       jsonb not null,
  message       text check (char_length(message) <= 280),
  created_at    timestamptz not null default now(),
  seen_at       timestamptz
);

create index if not exists shares_recipient_idx on public.shares(recipient_id, created_at desc);
create index if not exists shares_sender_idx on public.shares(sender_id, created_at desc);
create index if not exists shares_bundle_idx on public.shares(bundle_id);

alter table public.shares enable row level security;

drop policy if exists "See own shares" on public.shares;
create policy "See own shares"
  on public.shares for select
  using (auth.uid() in (sender_id, recipient_id));

drop policy if exists "Send shares to friends" on public.shares;
create policy "Send shares to friends"
  on public.shares for insert
  with check (auth.uid() = sender_id and public.are_friends(sender_id, recipient_id));

drop policy if exists "Mark shares seen" on public.shares;
create policy "Mark shares seen"
  on public.shares for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

drop policy if exists "Delete own shares" on public.shares;
create policy "Delete own shares"
  on public.shares for delete
  using (auth.uid() in (sender_id, recipient_id));

-- Sender names for the inbox (shares are only visible to their two parties)
create or replace function public.list_shares()
returns table (
  id uuid,
  kind text,
  payload jsonb,
  message text,
  created_at timestamptz,
  seen_at timestamptz,
  direction text,
  other_id uuid,
  other_name text
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.kind, s.payload, s.message, s.created_at, s.seen_at,
    case when s.sender_id = auth.uid() then 'sent' else 'received' end,
    p.id, p.name
  from public.shares s
  join public.profiles p
    on p.id = case when s.sender_id = auth.uid() then s.recipient_id else s.sender_id end
  where auth.uid() in (s.sender_id, s.recipient_id)
  order by s.created_at desc;
$$;

-- ── Storage: shared photos ────────────────────────────────────────────────────
-- Private bucket. Paths are <sender_id>/<bundle_id>/<file>, so one upload
-- serves every friend a piece was sent to at once. The sender can upload into
-- their own folder; anyone who received a share from that bundle can read.

insert into storage.buckets (id, name, public)
values ('shared-images', 'shared-images', false)
on conflict (id) do nothing;

drop policy if exists "Upload shared images" on storage.objects;
create policy "Upload shared images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shared-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Read shared images" on storage.objects;
create policy "Read shared images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'shared-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.shares s
        where s.bundle_id::text = (storage.foldername(name))[2]
          and s.recipient_id = auth.uid()
      )
    )
  );

drop policy if exists "Delete shared images" on storage.objects;
create policy "Delete shared images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shared-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
