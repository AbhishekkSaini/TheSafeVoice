-- Username change limits for SafeVoice
-- Policy: change allowed only if last change was >= 7 days ago
-- and no more than 3 changes in the last 30 days

-- History table (idempotent)
create table if not exists public.profile_username_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_username text,
  new_username text not null,
  changed_at timestamptz not null default now()
);

-- Helpful index for lookups
create index if not exists idx_username_changes_user_time
  on public.profile_username_changes(user_id, changed_at desc);

-- Drop and recreate RPC to enforce limits
drop function if exists public.set_username(text);

create or replace function public.set_username(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.profiles;
  taken boolean;
  current_username text;
  last_change timestamptz;
  month_changes int := 0;
  next_allowed_at timestamptz;
begin
  if p_username is null or length(trim(p_username)) < 3 then
    raise exception 'Username too short (min 3)';
  end if;

  -- Normalize
  p_username := trim(p_username);

  -- Uniqueness (case-insensitive)
  select exists(
    select 1 from public.profiles
    where lower(username) = lower(p_username)
      and id <> auth.uid()
  ) into taken;
  if taken then
    raise exception 'Username already taken' using errcode='23505';
  end if;

  -- Current username and limits
  select username into current_username from public.profiles where id = auth.uid();
  select max(changed_at) into last_change from public.profile_username_changes where user_id = auth.uid();
  select count(1) into month_changes
  from public.profile_username_changes
  where user_id = auth.uid() and changed_at >= now() - interval '30 days';

  if current_username is not null then
    -- No-op
    if lower(current_username) = lower(p_username) then
      raise exception 'Username unchanged';
    end if;

    -- 7-day cool-down
    if last_change is not null and now() < last_change + interval '7 days' then
      next_allowed_at := last_change + interval '7 days';
      raise exception 'You can change your username again on %', next_allowed_at;
    end if;

    -- 3 changes per 30 days
    if month_changes >= 3 then
      raise exception 'Username change limit reached (3 per 30 days)';
    end if;
  end if;

  -- Update profile
  update public.profiles
  set username = p_username
  where id = auth.uid()
  returning * into rec;

  -- Log change
  insert into public.profile_username_changes(user_id, old_username, new_username)
  values (auth.uid(), current_username, p_username);

  return rec;
end;
$$;

grant execute on function public.set_username(text) to authenticated;

-- Make sure PostgREST sees it
do $$ begin perform pg_notify('pgrst','reload schema'); exception when others then null; end $$;


