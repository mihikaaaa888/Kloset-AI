-- Profile photo sync. Run once in the Supabase SQL Editor (safe to re-run), after wardrobe_photos.sql.
-- The photo file goes in the existing private wardrobe-images bucket, in the user's own folder
-- (`<user id>/avatar-<id>.jpg`), so the bucket's per-user policies already cover it.
-- This column only remembers which file is the current photo.

alter table public.profiles
  add column if not exists avatar_path text;
