-- Atsumeru minimal schema for RSVP + payment check
-- Apply in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date timestamptz null,
  place text null,
  note text null,
  collecting boolean not null default false,
  amount integer not null default 0,
  pay_url text null,
  owner_token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  rsvp text not null check (rsvp in ('yes', 'maybe', 'no')),
  paid boolean not null default false,
  paid_at timestamptz null,
  edit_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_responses_event_created_at
  on public.responses(event_id, created_at);

create index if not exists idx_responses_event_name
  on public.responses(event_id, name);

alter table public.events enable row level security;
alter table public.responses enable row level security;

-- Public can read event basics for participant page.
drop policy if exists events_select_public on public.events;
create policy events_select_public
  on public.events
  for select
  to anon, authenticated
  using (true);

-- Responses are not directly readable/writable by anon users.
drop policy if exists responses_deny_all on public.responses;
create policy responses_deny_all
  on public.responses
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- App server uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS.
