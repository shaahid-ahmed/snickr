-- ── Notification preferences on profiles ──────────────────────────────────
alter table profiles add column if not exists notif_mentions boolean not null default true;
alter table profiles add column if not exists notif_dms      boolean not null default true;

-- ── Notifications table ────────────────────────────────────────────────────
create table if not exists notifications (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  type            text        not null check (type in ('mention', 'dm')),
  message_id      uuid        references messages(id)          on delete cascade,
  channel_id      uuid        references channels(id)          on delete cascade,
  conversation_id uuid        references dm_conversations(id)  on delete cascade,
  from_user_id    uuid        references profiles(id)          on delete set null,
  content_preview text,
  is_read         boolean     not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists notif_user_ws    on notifications (user_id, workspace_id, created_at desc);
create index if not exists notif_unread_idx on notifications (user_id, is_read) where not is_read;

alter table notifications enable row level security;

create policy "notif_select" on notifications
  for select using (auth.uid() = user_id);

create policy "notif_update" on notifications
  for update using (auth.uid() = user_id);

-- ── Trigger: create mention notifications on message insert ────────────────
create or replace function create_mention_notifications()
returns trigger language plpgsql security definer as $$
declare
  uname      text;
  target_id  uuid;
  wants_notif boolean;
begin
  -- Don't leak one-time message content
  if new.is_one_time then return new; end if;

  for uname in
    select (regexp_matches(new.content, '@([A-Za-z0-9_]+)', 'g'))[1]
  loop
    select p.id, p.notif_mentions
    into   target_id, wants_notif
    from   profiles p
    where  p.username = uname
    limit  1;

    if found
       and target_id <> new.sender_id
       and coalesce(wants_notif, true)
    then
      insert into notifications
        (user_id, workspace_id, type, message_id, channel_id, conversation_id, from_user_id, content_preview)
      values
        (target_id, new.workspace_id, 'mention', new.id,
         new.channel_id, new.conversation_id, new.sender_id,
         left(new.content, 160))
      on conflict do nothing;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_mention_notifications on messages;
create trigger trg_mention_notifications
  after insert on messages
  for each row
  execute function create_mention_notifications();

-- ── Trigger: create DM notifications on message insert ────────────────────
create or replace function create_dm_notifications()
returns trigger language plpgsql security definer as $$
begin
  if new.conversation_id is null then return new; end if;
  if new.is_one_time      then return new; end if;

  insert into notifications
    (user_id, workspace_id, type, message_id, conversation_id, from_user_id, content_preview)
  select
    dm.user_id,
    new.workspace_id,
    'dm',
    new.id,
    new.conversation_id,
    new.sender_id,
    left(new.content, 160)
  from dm_members dm
  join profiles p on dm.user_id = p.id
  where dm.conversation_id = new.conversation_id
    and dm.user_id          <> new.sender_id
    and coalesce(p.notif_dms, true);

  return new;
end;
$$;

drop trigger if exists trg_dm_notifications on messages;
create trigger trg_dm_notifications
  after insert on messages
  for each row
  execute function create_dm_notifications();
