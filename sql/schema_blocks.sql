-- Optional: User blocking
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint user_blocks_unique unique (blocker_id, blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists blocks_owner_select on public.user_blocks;
create policy blocks_owner_select on public.user_blocks for select using (auth.uid() = blocker_id);

drop policy if exists blocks_owner_insert on public.user_blocks;
create policy blocks_owner_insert on public.user_blocks for insert with check (auth.uid() = blocker_id);

drop policy if exists blocks_owner_delete on public.user_blocks;
create policy blocks_owner_delete on public.user_blocks for delete using (auth.uid() = blocker_id);

-- Enforce blocks when sending messages
drop policy if exists messages_sender_insert on public.messages;
create policy messages_sender_insert on public.messages
  for insert with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = receiver_id and b.blocked_id = auth.uid()
    )
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = receiver_id
    )
  );


