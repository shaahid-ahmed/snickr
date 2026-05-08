-- ── message_reactions ──────────────────────────────────────────────────────
create table if not exists message_reactions (
  id         uuid        primary key default gen_random_uuid(),
  message_id uuid        not null references messages(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  emoji      text        not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table message_reactions enable row level security;

-- Anyone in the workspace can view reactions (messages RLS already guards the parent)
create policy "reactions_select" on message_reactions
  for select using (true);

-- Users can insert their own reactions
create policy "reactions_insert" on message_reactions
  for insert with check (auth.uid() = user_id);

-- Users can delete only their own reactions
create policy "reactions_delete" on message_reactions
  for delete using (auth.uid() = user_id);

-- ── One-time message columns (safe to run even if they exist) ──────────────
alter table messages add column if not exists is_one_time boolean  not null default false;
alter table messages add column if not exists viewed_by   uuid[]   not null default '{}';

-- ── RPC: atomically add viewer to viewed_by (prevents duplicates) ──────────
create or replace function mark_one_time_viewed(p_message_id uuid)
returns void language plpgsql security definer as $$
begin
  update messages
  set    viewed_by = array_append(coalesce(viewed_by, '{}'), auth.uid())
  where  id        = p_message_id
    and  is_one_time
    and  not (auth.uid() = any(coalesce(viewed_by, '{}')));
end;
$$;
