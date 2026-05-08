-- =============================================================================
-- 0001_base.sql  ·  Snikr base schema
-- Profiles · Workspaces · Channels · DMs · Messages · Attachments + RLS
-- Phase 3 columns pre-baked (is_one_time, viewed_by, ghost_count, no_download …)
-- so future migrations never make breaking changes to existing tables.
-- =============================================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────────────────────
create type user_status    as enum ('available', 'busy', 'away');
create type workspace_role as enum ('owner', 'admin', 'member');
create type channel_role   as enum ('admin', 'member');

-- =============================================================================
-- PROFILES
-- =============================================================================
create table profiles (
  id           uuid        primary key references auth.users on delete cascade,
  username     text        not null unique,
  full_name    text,
  avatar_url   text,
  status       user_status not null default 'available',
  is_dnd       boolean     not null default false,
  ghost_count  integer     not null default 0,   -- Phase 3: left-on-read counter
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_fmt check (username ~ '^[a-z0-9_]{2,30}$')
);

-- Keep updated_at current on every row update
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure touch_updated_at();

-- Auto-create a profile row when a new auth user is created
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '_', 'g')
    ),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================================================
-- WORKSPACES
-- =============================================================================
create table workspaces (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  slug       text        not null unique,
  logo_url   text,
  owner_id   uuid        not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint workspaces_slug_fmt check (slug ~ '^[a-z0-9-]{2,50}$')
);

-- =============================================================================
-- WORKSPACE MEMBERS
-- =============================================================================
create table workspace_members (
  workspace_id uuid           not null references workspaces(id) on delete cascade,
  user_id      uuid           not null references profiles(id)   on delete cascade,
  role         workspace_role not null default 'member',
  joined_at    timestamptz    not null default now(),
  primary key (workspace_id, user_id)
);

-- =============================================================================
-- WORKSPACE INVITES
-- =============================================================================
create table workspace_invites (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  created_by   uuid        not null references profiles(id),
  expires_at   timestamptz,
  max_uses     integer,
  use_count    integer     not null default 0,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- CHANNELS
-- =============================================================================
create table channels (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  name         text        not null,
  description  text,
  is_private   boolean     not null default false,
  is_archived  boolean     not null default false,
  logo_url     text,                              -- Phase 3 pre-baked
  created_by   uuid        not null references profiles(id),
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

-- =============================================================================
-- CHANNEL MEMBERS
-- =============================================================================
create table channel_members (
  channel_id   uuid         not null references channels(id)  on delete cascade,
  user_id      uuid         not null references profiles(id)  on delete cascade,
  role         channel_role not null default 'member',
  is_pinned    boolean      not null default false,
  last_read_at timestamptz,
  joined_at    timestamptz  not null default now(),
  primary key (channel_id, user_id)
);

-- =============================================================================
-- DM CONVERSATIONS
-- =============================================================================
create table dm_conversations (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- DM MEMBERS
-- =============================================================================
create table dm_members (
  conversation_id uuid        not null references dm_conversations(id) on delete cascade,
  user_id         uuid        not null references profiles(id)         on delete cascade,
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

-- =============================================================================
-- MESSAGES
-- =============================================================================
create table messages (
  id               uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        not null references workspaces(id)      on delete cascade,
  channel_id       uuid        references channels(id)                 on delete cascade,
  conversation_id  uuid        references dm_conversations(id)         on delete cascade,
  sender_id        uuid        not null references profiles(id),
  content          text        not null default '',
  edited_at        timestamptz,
  is_deleted       boolean     not null default false,
  thread_parent_id uuid        references messages(id)                 on delete cascade,
  -- Phase 3 pre-baked: one-time messages
  is_one_time      boolean     not null default false,
  viewed_by        uuid[]      not null default '{}',
  -- Full-text search (auto-maintained by Postgres)
  search_vector    tsvector    generated always as (
                     to_tsvector('english', coalesce(content, ''))
                   ) stored,
  created_at       timestamptz not null default now()
);

create index messages_search_idx       on messages using gin(search_vector);
create index messages_channel_idx      on messages(channel_id, created_at)
  where channel_id is not null;
create index messages_conversation_idx on messages(conversation_id, created_at)
  where conversation_id is not null;
create index messages_thread_idx       on messages(thread_parent_id)
  where thread_parent_id is not null;
create index messages_sender_idx       on messages(sender_id);
create index messages_workspace_idx    on messages(workspace_id, created_at);

-- =============================================================================
-- ATTACHMENTS
-- =============================================================================
create table attachments (
  id           uuid        primary key default gen_random_uuid(),
  message_id   uuid        not null references messages(id) on delete cascade,
  name         text        not null,
  url          text        not null,
  mime_type    text        not null,
  size_bytes   bigint,
  -- Phase 3 pre-baked: document restrictions
  no_download  boolean     not null default false,
  no_forward   boolean     not null default false,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================
alter table profiles          enable row level security;
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table channels          enable row level security;
alter table channel_members   enable row level security;
alter table dm_conversations  enable row level security;
alter table dm_members        enable row level security;
alter table messages          enable row level security;
alter table attachments       enable row level security;

-- ── Helper functions ─────────────────────────────────────────────────────────
create or replace function is_workspace_member(wid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = wid and user_id = auth.uid()
  );
$$;

create or replace function is_channel_member(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from channel_members
    where channel_id = cid and user_id = auth.uid()
  );
$$;

create or replace function is_channel_admin(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from channel_members
    where channel_id = cid and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_dm_member(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from dm_members
    where conversation_id = cid and user_id = auth.uid()
  );
$$;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Own profile always visible; others visible if you share a workspace
create policy "profiles_select" on profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from workspace_members a
    join workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy "profiles_insert" on profiles for insert with check (id = auth.uid());
create policy "profiles_update" on profiles for update using (id = auth.uid());

-- ── workspaces ───────────────────────────────────────────────────────────────
create policy "workspaces_select" on workspaces for select
  using (is_workspace_member(id));

create policy "workspaces_insert" on workspaces for insert
  with check (auth.uid() = owner_id);

create policy "workspaces_update" on workspaces for update
  using (
    exists (
      select 1 from workspace_members
      where workspace_id = id and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- ── workspace_members ────────────────────────────────────────────────────────
create policy "wm_select" on workspace_members for select
  using (is_workspace_member(workspace_id));

create policy "wm_insert" on workspace_members for insert
  with check (user_id = auth.uid());

create policy "wm_delete" on workspace_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid() and wm.role in ('owner', 'admin')
    )
  );

-- ── workspace_invites ────────────────────────────────────────────────────────
-- Public read: anyone needs to fetch an invite to join
create policy "wi_select" on workspace_invites for select using (true);

create policy "wi_insert" on workspace_invites for insert
  with check (
    exists (
      select 1 from workspace_members
      where workspace_id = workspace_invites.workspace_id
        and user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "wi_update" on workspace_invites for update
  using (is_workspace_member(workspace_id));

-- ── channels ─────────────────────────────────────────────────────────────────
create policy "channels_select" on channels for select
  using (
    is_workspace_member(workspace_id)
    and (not is_private or is_channel_member(id))
  );

create policy "channels_insert" on channels for insert
  with check (
    is_workspace_member(workspace_id)
    and auth.uid() = created_by
  );

create policy "channels_update" on channels for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from workspace_members
      where workspace_id = channels.workspace_id
        and user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ── channel_members ──────────────────────────────────────────────────────────
create policy "cm_select" on channel_members for select
  using (
    is_workspace_member(
      (select workspace_id from channels where id = channel_id)
    )
  );

create policy "cm_insert" on channel_members for insert
  with check (
    (user_id = auth.uid() and is_workspace_member((select workspace_id from channels where id = channel_id)))
    or is_channel_admin(channel_id)
  );

create policy "cm_update" on channel_members for update
  using (user_id = auth.uid() or is_channel_admin(channel_id));

create policy "cm_delete" on channel_members for delete
  using (user_id = auth.uid() or is_channel_admin(channel_id));

-- ── dm_conversations ─────────────────────────────────────────────────────────
create policy "dc_select" on dm_conversations for select
  using (is_dm_member(id));

create policy "dc_insert" on dm_conversations for insert
  with check (is_workspace_member(workspace_id));

-- ── dm_members ───────────────────────────────────────────────────────────────
create policy "dm_select" on dm_members for select
  using (is_dm_member(conversation_id));

create policy "dm_insert" on dm_members for insert
  with check (
    is_workspace_member(
      (select workspace_id from dm_conversations where id = conversation_id)
    )
  );

create policy "dm_update" on dm_members for update
  using (user_id = auth.uid());

-- ── messages ─────────────────────────────────────────────────────────────────
create policy "messages_select" on messages for select
  using (
    is_workspace_member(workspace_id)
    and (
      (channel_id is not null and is_channel_member(channel_id))
      or (conversation_id is not null and is_dm_member(conversation_id))
    )
  );

create policy "messages_insert" on messages for insert
  with check (
    auth.uid() = sender_id
    and is_workspace_member(workspace_id)
    and (
      (channel_id is not null and is_channel_member(channel_id))
      or (conversation_id is not null and is_dm_member(conversation_id))
    )
  );

create policy "messages_update" on messages for update
  using (auth.uid() = sender_id);

-- ── attachments ──────────────────────────────────────────────────────────────
create policy "attachments_select" on attachments for select
  using (
    exists (
      select 1 from messages m
      where m.id = attachments.message_id
        and is_workspace_member(m.workspace_id)
    )
  );

create policy "attachments_insert" on attachments for insert
  with check (
    exists (
      select 1 from messages m
      where m.id = attachments.message_id and m.sender_id = auth.uid()
    )
  );

-- =============================================================================
-- REALTIME
-- =============================================================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table channels;
alter publication supabase_realtime add table channel_members;
alter publication supabase_realtime add table dm_members;
