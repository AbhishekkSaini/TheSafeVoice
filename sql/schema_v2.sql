-- TheSafeVoice — Clean Supabase Schema (idempotent)
-- Paste this into Supabase SQL editor and run once

-- 1) Extensions
create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- 2) Core tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  phone text,
  username text,
  role text not null default 'member',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  email_normalized text,
  phone_normalized text
);

create table if not exists public.categories (
  key text primary key,
  label text not null
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  category text,
  region text,
  audio_url text,
  is_anonymous boolean not null default false,
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  reshares integer not null default 0,
  flags integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  audio_url text,
  is_anonymous boolean not null default false,
  upvotes integer not null default 0,
  flags integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  created_at timestamptz default now()
);

create table if not exists public.sos_success (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.sos_events(id) on delete set null,
  title text not null,
  story text not null,
  created_at timestamptz default now()
);

create table if not exists public.resources_verified (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null,
  region text,
  url text,
  phone text,
  verified boolean not null default true,
  created_at timestamptz default now()
);

-- 3) Views (drop/create to be safe)
drop view if exists public.posts_view;
create view public.posts_view as
select p.*, coalesce(pr.display_name, '') as author_display_name,
       (
         select count(1) from public.comments c where c.post_id = p.id
       ) as comments_count
from public.posts p
left join public.profiles pr on pr.id = p.author_id;

drop view if exists public.comments_view;
create view public.comments_view as
select c.*, coalesce(pr.display_name, '') as author_display_name
from public.comments c
left join public.profiles pr on pr.id = c.author_id;

-- 4) RLS
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.messages enable row level security;
alter table public.sos_events enable row level security;
alter table public.profiles enable row level security;
alter table public.sos_success enable row level security;
alter table public.resources_verified enable row level security;

-- Posts
create policy if not exists posts_read on public.posts for select using (true);
create policy if not exists posts_insert on public.posts for insert with check (auth.uid() is not null);
create policy if not exists posts_update_own on public.posts for update using (author_id = auth.uid());

-- Comments
create policy if not exists comments_read on public.comments for select using (true);
create policy if not exists comments_insert on public.comments for insert with check (auth.uid() is not null);
create policy if not exists comments_update_own on public.comments for update using (author_id = auth.uid());

-- Profiles
create policy if not exists profiles_read on public.profiles for select using (true);
create policy if not exists profiles_upsert_self on public.profiles for insert with check (id = auth.uid());
create policy if not exists profiles_update_self on public.profiles for update using (id = auth.uid());

-- Messages (participants only)
drop policy if exists messages_participants_select on public.messages;
create policy messages_participants_select on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
drop policy if exists messages_sender_insert on public.messages;
create policy messages_sender_insert on public.messages
  for insert with check (auth.uid() = sender_id);

-- SOS
create policy if not exists sos_read_public on public.sos_events for select using (true);
create policy if not exists sos_insert_any on public.sos_events for insert with check (true);

create policy if not exists sos_success_public_read on public.sos_success for select using (true);
create policy if not exists resources_public_read on public.resources_verified for select using (true);

-- 5) Normalization helpers and constraints
create or replace function public.normalize_email(p text)
returns text language sql immutable as $$ select nullif(lower(trim(p)),'') $$;

create or replace function public.normalize_phone_india(p text)
returns text language sql immutable as $$
  select case when p is null then null else '+91' || right(regexp_replace(p,'[^0-9]+','','g'),10) end
$$;

create or replace function public.set_normalized_profile_keys()
returns trigger language plpgsql as $$
begin
  new.email_normalized := public.normalize_email(new.email);
  new.phone_normalized := public.normalize_phone_india(new.phone);
  return new;
end; $$;

drop trigger if exists trg_profiles_norm on public.profiles;
create trigger trg_profiles_norm before insert or update on public.profiles
for each row execute function public.set_normalized_profile_keys();

do $$ begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='profiles_email_unique_ci') then
    create unique index profiles_email_unique_ci on public.profiles(email_normalized) where email_normalized is not null;
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='profiles_phone_unique_norm') then
    create unique index profiles_phone_unique_norm on public.profiles(phone_normalized) where phone_normalized is not null;
  end if;
end $$;

alter table public.profiles add constraint phone_india_format
  check (phone_normalized is null or phone_normalized ~ '^\+91[6-9][0-9]{9}$');

-- Case-insensitive unique username
do $$ begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='profiles_username_unique_ci') then
    create unique index profiles_username_unique_ci on public.profiles ((lower(username))) where username is not null;
  end if;
end $$;

-- 6) RPC helpers
create or replace function public.upsert_profile_secure(
  p_id uuid,
  p_email text,
  p_phone text,
  p_display_name text default null
)
returns public.profiles
language plpgsql security definer set search_path=public as $$
declare rec public.profiles;
begin
  insert into public.profiles(id,email,phone,display_name)
  values(p_id,p_email,p_phone,coalesce(p_display_name,''))
  on conflict (id) do update
    set email=excluded.email,
        phone=excluded.phone,
        display_name=excluded.display_name
  returning * into rec;
  return rec;
exception when unique_violation then
  raise exception 'Account already exists with this email or mobile number' using errcode='23505';
end; $$;
grant execute on function public.upsert_profile_secure(uuid,text,text,text) to anon, authenticated;

create or replace function public.email_or_phone_available(
  p_email text,
  p_phone text
)
returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare exists_email boolean := false; exists_phone boolean := false;
begin
  select exists(
    select 1 from auth.users u where lower(trim(u.email)) = lower(trim(p_email))
  ) into exists_email;

  select exists(
    select 1 from public.profiles p where p.phone_normalized = public.normalize_phone_india(p_phone)
  ) into exists_phone;

  return not (exists_email or exists_phone);
end; $$;
grant execute on function public.email_or_phone_available(text,text) to anon, authenticated;

-- Voting helpers used by the UI
create or replace function public.post_upvote(p_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.posts set upvotes = coalesce(upvotes,0)+1 where id = p_id;
$$;
create or replace function public.post_downvote(p_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.posts set downvotes = coalesce(downvotes,0)+1 where id = p_id;
$$;
create or replace function public.post_reshare(p_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.posts set reshares = coalesce(reshares,0)+1 where id = p_id;
$$;
create or replace function public.comment_upvote(p_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.comments set upvotes = coalesce(upvotes,0)+1 where id = p_id;
$$;
grant execute on function public.post_upvote(uuid) to anon, authenticated;
grant execute on function public.post_downvote(uuid) to anon, authenticated;
grant execute on function public.post_reshare(uuid) to anon, authenticated;
grant execute on function public.comment_upvote(uuid) to anon, authenticated;

-- Resolve user id by email for messaging
create or replace function public.resolve_user_id_by_email(p_email text)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare v uuid;
begin
  select u.id into v from auth.users u
  where lower(trim(u.email)) = lower(trim(p_email)) limit 1;
  return v;
end; $$;
grant execute on function public.resolve_user_id_by_email(text) to authenticated;

-- Set username (enforces uniqueness)
create or replace function public.set_username(p_username text)
returns public.profiles
language plpgsql security definer set search_path=public as $$
declare rec public.profiles; taken boolean;
begin
  if p_username is null or length(trim(p_username)) < 3 then
    raise exception 'Username too short (min 3)';
  end if;
  select exists(
    select 1 from public.profiles where lower(username) = lower(p_username) and id <> auth.uid()
  ) into taken;
  if taken then raise exception 'Username already taken' using errcode='23505'; end if;
  update public.profiles set username = trim(p_username) where id = auth.uid() returning * into rec;
  return rec;
end; $$;
grant execute on function public.set_username(text) to authenticated;

-- 7) Seed minimal categories
insert into public.categories(key, label) values
  ('safety_tips','Safety Tips') on conflict do nothing;
insert into public.categories(key, label) values
  ('legal_advice','Legal Advice') on conflict do nothing;
insert into public.categories(key, label) values
  ('emergency_help','SOS & Immediate Help') on conflict do nothing;
insert into public.categories(key, label) values
  ('survivor_stories','Survivor Stories') on conflict do nothing;

-- 8) Make sure PostgREST sees the changes
grant usage on schema public to anon, authenticated;
do $$ begin perform pg_notify('pgrst', 'reload schema'); exception when others then null; end $$;


