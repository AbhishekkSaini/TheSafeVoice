-- SafeVoice schema for Supabase (PostgreSQL)

-- Auth users are managed by Supabase; related profile table for public info
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    phone text,
    email text generated always as ((select email from auth.users where auth.users.id = id)) stored,
    role text not null default 'member', -- 'member' | 'admin' | 'moderator'
    preferences jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone default now()
);

-- Forum categories (optional seed; posts also store category key directly)
create table if not exists public.categories (
    key text primary key,
    label text not null
);

-- Posts
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
    flags integer not null default 0,
    created_at timestamp with time zone default now()
);

-- Comments
create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.posts(id) on delete cascade,
    author_id uuid references auth.users(id) on delete set null,
    parent_id uuid references public.comments(id) on delete cascade,
    body text not null,
    audio_url text,
    is_anonymous boolean not null default false,
    flags integer not null default 0,
    created_at timestamp with time zone default now()
);

-- Private messages: only between mutually trusted members (enforce in RLS/policies)
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    sender_id uuid not null references auth.users(id) on delete cascade,
    receiver_id uuid not null references auth.users(id) on delete cascade,
    body text not null,
    created_at timestamp with time zone default now()
);

-- SOS events
create table if not exists public.sos_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    lat double precision,
    lng double precision,
    accuracy_m double precision,
    created_at timestamp with time zone default now()
);

-- SOS success stories (for homepage strip)
create table if not exists public.sos_success (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references public.sos_events(id) on delete set null,
    title text not null,
    story text not null,
    created_at timestamp with time zone default now()
);

-- Verified resources directory
create table if not exists public.resources_verified (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    kind text not null, -- 'lawyer' | 'shelter' | 'hotline' | 'ngo'
    region text,
    url text,
    phone text,
    verified boolean not null default true,
    created_at timestamp with time zone default now()
);

-- Materialized views or SQL views for convenient joins
create view if not exists public.posts_view as
select p.*, coalesce(pr.display_name, '') as author_display_name,
       (select count(1) from public.comments c where c.post_id = p.id) as comments_count
from public.posts p
left join public.profiles pr on pr.id = p.author_id;

create view if not exists public.comments_view as
select c.*, coalesce(pr.display_name, '') as author_display_name
from public.comments c
left join public.profiles pr on pr.id = c.author_id;

-- RLS for privacy and safety; adjust as needed
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.messages enable row level security;
alter table public.sos_events enable row level security;
alter table public.profiles enable row level security;
alter table public.sos_success enable row level security;
alter table public.resources_verified enable row level security;

-- Allow read for all on forum data; write only for authenticated
create policy if not exists "public_read_posts" on public.posts for select using (true);
create policy if not exists "insert_posts_auth" on public.posts for insert with check (auth.uid() is not null);
create policy if not exists "update_own_posts" on public.posts for update using (author_id = auth.uid());

create policy if not exists "public_read_comments" on public.comments for select using (true);
create policy if not exists "insert_comments_auth" on public.comments for insert with check (auth.uid() is not null);
create policy if not exists "update_own_comments" on public.comments for update using (author_id = auth.uid());

create policy if not exists "profile_self_read" on public.profiles for select using (true);
create policy if not exists "profile_self_upsert" on public.profiles for insert with check (id = auth.uid());
create policy if not exists "profile_self_update" on public.profiles for update using (id = auth.uid());

create policy if not exists "sos_read_own_or_public" on public.sos_events for select using (true);
create policy if not exists "sos_insert_auth" on public.sos_events for insert with check (true);

create policy if not exists "sos_success_public_read" on public.sos_success for select using (true);
create policy if not exists "resources_public_read" on public.resources_verified for select using (true);
-- Messages policies (participants only)
create policy if not exists "messages_participants_select" on public.messages
    for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy if not exists "messages_sender_insert" on public.messages
    for insert with check (auth.uid() = sender_id);

-- Basic moderation counts; you can also add triggers for AI moderation queues
-- Seed categories
insert into public.categories(key, label) values
    ('safety_tips', 'Safety Tips') on conflict do nothing;
insert into public.categories(key, label) values
    ('legal_advice', 'Legal Advice') on conflict do nothing;
insert into public.categories(key, label) values
    ('emergency_help', 'SOS & Immediate Help') on conflict do nothing;
insert into public.categories(key, label) values
    ('survivor_stories', 'Survivor Stories') on conflict do nothing;

-- Demo seed posts (safe to run multiple times; uses deterministic ids per title)
do $$
declare
  titles text[] := array[
    'Night commute checklist for metro cities',
    'How to file an FIR without intimidation',
    'Need advice about workplace harassment policy',
    'Sharing my experience anonymously — it helped',
    'Self-defense basics you can learn at home',
    'Best personal safety apps 2025 comparison',
    'Zero-FIR — step by step explained',
    'What to do if you are being followed',
    'Finding a reliable women-only cab at night',
    'How to document harassment safely'
  ];
  bodies text[] := array[
    'Practical tips community compiled. Add yours below.',
    'Legal steps, sample language, and your rights.',
    'HR process, documentation, and escalation path.',
    'An anonymous story that resonated with many.',
    'Simple moves that create time and distance.',
    'We tested apps: pros, cons, privacy notes.',
    'Zero-FIR can be filed anywhere. Here''s how.',
    'Situational awareness and safe exits.',
    'Community vetted suggestions for safer rides.',
    'How to keep a paper trail without risk.'
  ];
  cats text[] := array['safety_tips','legal_advice','emergency_help','survivor_stories','safety_tips','safety_tips','legal_advice','emergency_help','safety_tips','legal_advice'];
  i int;
  exists_count int;
begin
  for i in 1..array_length(titles,1) loop
    select count(*) into exists_count from public.posts where title = titles[i];
    if exists_count = 0 then
      insert into public.posts (title, body, category, is_anonymous, upvotes)
      values (titles[i], bodies[i], cats[i], true, (random()*400)::int);
    end if;
  end loop;
end $$;

-- Additional demo posts to reach ~60 total (idempotent)
do $$
declare
  g int;
  cat_keys text[] := array['safety_tips','legal_advice','emergency_help','survivor_stories'];
begin
  for g in 1..50 loop
    if not exists (select 1 from public.posts where title = 'Community safety tip #' || g) then
      insert into public.posts (title, body, category, is_anonymous, upvotes, created_at)
      values (
        'Community safety tip #' || g,
        'Crowd-sourced advice and learnings from the community. Tip #' || g || ' — add your experience below.',
        cat_keys[1 + (floor(random()*array_length(cat_keys,1)))::int],
        true,
        (random()*400)::int,
        now() - (random()* interval '10 days')
      );
    end if;
  end loop;
end $$;

-- Voting and flagging helpers
create or replace function public.upvote_post(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.posts set upvotes = upvotes + 1 where id = p_id;
$$;

create or replace function public.flag_post(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.posts set flags = flags + 1 where id = p_id;
$$;

grant execute on function public.upvote_post(uuid) to anon, authenticated;
grant execute on function public.flag_post(uuid) to anon, authenticated;

-- Uniqueness constraint for phone numbers (enforced at DB level)
-- Normalize helpers and hard unique constraints for duplicates protection
create or replace function public.normalize_email(p text)
returns text language sql immutable as $$ select nullif(lower(trim(p)),'') $$;

create or replace function public.normalize_phone_india(p text)
returns text language sql immutable as $$ select case when p is null then null else '+91' || right(regexp_replace(p,'[^0-9]+','','g'),10) end $$;

alter table public.profiles add column if not exists email_normalized text;
alter table public.profiles add column if not exists phone_normalized text;

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

-- Preflight checker to prevent sending email if user or phone already taken
create or replace function public.email_or_phone_available(
  p_email text,
  p_phone text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  exists_email boolean := false;
  exists_phone boolean := false;
begin
  -- case-insensitive email check in auth.users
  select exists(
    select 1 from auth.users u
    where lower(trim(u.email)) = lower(trim(p_email))
  ) into exists_email;

  -- normalized phone check in profiles (if any)
  select exists(
    select 1 from public.profiles p
    where p.phone_normalized = public.normalize_phone_india(p_phone)
  ) into exists_phone;

  return not (exists_email or exists_phone);
end; $$;

grant execute on function public.email_or_phone_available(text,text) to anon, authenticated;

-- Ensure anon can read the posts_view and PostgREST sees it
grant select on public.posts_view to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Trigger PostgREST reload (safe to run; ignored if not present)
do $$ begin perform pg_notify('pgrst', 'reload schema'); exception when others then null; end $$;

-- Resolve user id by email for messaging (security-definer, authenticated-only)
create or replace function public.resolve_user_id_by_email(p_email text)
returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare v uuid;
begin
  select u.id into v
  from auth.users u
  where lower(trim(u.email)) = lower(trim(p_email))
  limit 1;
  return v;
end; $$;

grant execute on function public.resolve_user_id_by_email(text) to authenticated;


