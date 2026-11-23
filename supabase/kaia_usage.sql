-- Kaia chat allowance: messages each person has sent to Kaia per day (India
-- time). The server (server/app.mjs, /api/chat) takes one before calling the
-- AI and gives it back if the AI fails. Run once in the Supabase SQL Editor;
-- safe to re-run.

create table if not exists public.kaia_usage (
  user_id   uuid not null references auth.users(id) on delete cascade,
  day       date not null,
  messages  int  not null default 0 check (messages >= 0),
  primary key (user_id, day)
);

alter table public.kaia_usage enable row level security;

-- People can see their own count (the chat shows "N left today"). Nobody
-- writes it directly: only the server, through the functions below.
drop policy if exists "Read own Kaia usage" on public.kaia_usage;
create policy "Read own Kaia usage"
  on public.kaia_usage for select to authenticated
  using (auth.uid() = user_id);

-- Take one message if under the limit. Returns the count after taking it,
-- or null when today's limit is already used.
create or replace function public.kaia_take_message(p_user uuid, p_day date, p_limit int)
returns int
language plpgsql
set search_path = public
as $$
declare
  used int;
begin
  insert into public.kaia_usage (user_id, day, messages)
  values (p_user, p_day, 1)
  on conflict (user_id, day) do update
    set messages = public.kaia_usage.messages + 1
    where public.kaia_usage.messages < p_limit
  returning messages into used;
  return used;
end;
$$;

-- Give a message back (the AI failed, so it shouldn't count).
create or replace function public.kaia_return_message(p_user uuid, p_day date)
returns void
language sql
set search_path = public
as $$
  update public.kaia_usage
  set messages = greatest(messages - 1, 0)
  where user_id = p_user and day = p_day;
$$;

revoke all on function public.kaia_take_message(uuid, date, int) from public, anon, authenticated;
revoke all on function public.kaia_return_message(uuid, date) from public, anon, authenticated;
grant execute on function public.kaia_take_message(uuid, date, int) to service_role;
grant execute on function public.kaia_return_message(uuid, date) to service_role;

-- ─── Answers to Kaia's questions are free ───────────────────────────────────
-- When Kaia's reply asks the person a question, their next message is the
-- answer and doesn't use up a message. At most 10 free answers a day, so a
-- chat that keeps asking can't become unlimited.
alter table public.kaia_usage add column if not exists awaiting_answer boolean not null default false;
alter table public.kaia_usage add column if not exists free_answers int not null default 0 check (free_answers >= 0);

-- Kaia just asked a question: the next message is free.
create or replace function public.kaia_mark_question(p_user uuid, p_day date)
returns void
language sql
set search_path = public
as $$
  insert into public.kaia_usage (user_id, day, messages, awaiting_answer)
  values (p_user, p_day, 0, true)
  on conflict (user_id, day) do update set awaiting_answer = true;
$$;

-- Use a pending free answer. Returns today's message count (unchanged), or
-- null when there's no question waiting or today's free answers are used up.
create or replace function public.kaia_take_answer(p_user uuid, p_day date)
returns int
language sql
set search_path = public
as $$
  update public.kaia_usage
  set awaiting_answer = false, free_answers = free_answers + 1
  where user_id = p_user and day = p_day and awaiting_answer and free_answers < 10
  returning messages;
$$;

-- Give a free answer back (the AI failed, so the question is still waiting).
create or replace function public.kaia_return_answer(p_user uuid, p_day date)
returns void
language sql
set search_path = public
as $$
  update public.kaia_usage
  set awaiting_answer = true, free_answers = greatest(free_answers - 1, 0)
  where user_id = p_user and day = p_day;
$$;

revoke all on function public.kaia_mark_question(uuid, date) from public, anon, authenticated;
revoke all on function public.kaia_take_answer(uuid, date) from public, anon, authenticated;
revoke all on function public.kaia_return_answer(uuid, date) from public, anon, authenticated;
grant execute on function public.kaia_mark_question(uuid, date) to service_role;
grant execute on function public.kaia_take_answer(uuid, date) to service_role;
grant execute on function public.kaia_return_answer(uuid, date) to service_role;
