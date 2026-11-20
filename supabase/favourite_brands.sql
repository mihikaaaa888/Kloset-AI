-- Brands a person hearts on Shop (saved by saveFavouriteBrands in src/lib/profileService.ts).
-- The column sits on profiles, so the existing row-level security policies
-- (each user reads and updates only their own row) already cover it.
-- Safe to re-run.
alter table public.profiles
  add column if not exists favourite_brands text[] not null default '{}';
