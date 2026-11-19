-- Recommendation feedback: the thumbs up / down on outfits and pieces, plus
-- "looked at for a while" views. Run once in the Supabase SQL Editor (safe to
-- re-run). Kloset ranks outfits, shop picks and Kaia's advice from these, so
-- they're kept per account rather than only in one browser.

create table if not exists public.recommendation_feedback (
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- One row per vote target ("<itemId>") or per day's view ("dwell:<itemId>:<date>").
  -- A new vote on the same item replaces the old one.
  key         text not null,
  action      text not null check (action in ('like', 'dislike', 'dwell')),
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.recommendation_feedback enable row level security;

drop policy if exists "Read own recommendation feedback" on public.recommendation_feedback;
create policy "Read own recommendation feedback"
  on public.recommendation_feedback for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Add own recommendation feedback" on public.recommendation_feedback;
create policy "Add own recommendation feedback"
  on public.recommendation_feedback for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Change own recommendation feedback" on public.recommendation_feedback;
create policy "Change own recommendation feedback"
  on public.recommendation_feedback for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Delete own recommendation feedback" on public.recommendation_feedback;
create policy "Delete own recommendation feedback"
  on public.recommendation_feedback for delete to authenticated
  using (auth.uid() = user_id);
