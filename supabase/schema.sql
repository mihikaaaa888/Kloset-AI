-- Kloset database schema
-- Run this entire file in the Supabase SQL Editor.
-- Each section is idempotent (safe to re-run).

-- ── Enable UUID extension ──────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── profiles ──────────────────────────────────────────────────────────────────
-- One row per auth.users entry. Created automatically on signup via trigger.

create table if not exists public.profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  name                      text not null default '',
  age_range                 text,
  occupation                text,
  lifestyle                 text,
  style_preferences         text[]  not null default '{}',
  typical_occasions         text[]  not null default '{}',
  favourite_colours         text[]  not null default '{}',
  avoid_colours             text[]  not null default '{}',
  gender_style_preference   text,
  recommendation_frequency  text,
  onboarding_complete       boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Added after launch: the catalogue picks from onboarding step 4. Without this column
-- every profile save fails, so onboarding never syncs to other devices.
alter table public.profiles
  add column if not exists style_item_selections text[] not null default '{}';

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create an empty profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── wardrobe_items ────────────────────────────────────────────────────────────

create table if not exists public.wardrobe_items (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  category            text not null,
  subcategory         text,
  image_id            text,          -- IndexedDB key (local device cache)
  image_url           text,          -- legacy / external URL
  image_storage_path  text,          -- Supabase Storage path (Phase B+)
  image_source        text not null default 'none',
  colour              text[]  not null default '{}',
  material            text,
  pattern             text,
  fit                 text,
  formality           text,
  seasons             text[]  not null default '{}',
  occasions           text[]  not null default '{}',
  brand               text,
  notes               text,
  is_favourite        boolean not null default false,
  times_worn          integer not null default 0,
  last_worn           date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists wardrobe_items_user_id_idx on public.wardrobe_items(user_id);

alter table public.wardrobe_items enable row level security;

create policy "Users can read their own wardrobe"
  on public.wardrobe_items for select
  using (auth.uid() = user_id);

create policy "Users can insert into their own wardrobe"
  on public.wardrobe_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own wardrobe items"
  on public.wardrobe_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own wardrobe items"
  on public.wardrobe_items for delete
  using (auth.uid() = user_id);

-- ── saved_outfits ─────────────────────────────────────────────────────────────

create table if not exists public.saved_outfits (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  occasion      text,
  weather       text,
  mood          text,
  styling_notes text,
  why_it_works  text,
  generated_at  timestamptz not null default now(),
  source        text not null default 'ai-mock',
  created_at    timestamptz not null default now()
);

create index if not exists saved_outfits_user_id_idx on public.saved_outfits(user_id);

alter table public.saved_outfits enable row level security;

create policy "Users can read their own saved outfits"
  on public.saved_outfits for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved outfits"
  on public.saved_outfits for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved outfits"
  on public.saved_outfits for delete
  using (auth.uid() = user_id);

-- ── outfit_items ──────────────────────────────────────────────────────────────

create table if not exists public.outfit_items (
  id          uuid primary key default uuid_generate_v4(),
  outfit_id   uuid not null references public.saved_outfits(id) on delete cascade,
  item_id     uuid not null references public.wardrobe_items(id) on delete cascade,
  role        text
);

create index if not exists outfit_items_outfit_id_idx on public.outfit_items(outfit_id);

alter table public.outfit_items enable row level security;

-- outfit_items are visible if the parent outfit belongs to the user
create policy "Users can read outfit items for their outfits"
  on public.outfit_items for select
  using (
    exists (
      select 1 from public.saved_outfits
      where id = outfit_items.outfit_id
        and user_id = auth.uid()
    )
  );

create policy "Users can insert outfit items for their outfits"
  on public.outfit_items for insert
  with check (
    exists (
      select 1 from public.saved_outfits
      where id = outfit_items.outfit_id
        and user_id = auth.uid()
    )
  );

create policy "Users can delete outfit items for their outfits"
  on public.outfit_items for delete
  using (
    exists (
      select 1 from public.saved_outfits
      where id = outfit_items.outfit_id
        and user_id = auth.uid()
    )
  );

-- ── updated_at trigger ────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_wardrobe_items_updated_at on public.wardrobe_items;
create trigger set_wardrobe_items_updated_at
  before update on public.wardrobe_items
  for each row execute procedure public.set_updated_at();
