-- ── get_channel_media ─────────────────────────────────────────────────────
-- Returns all non-deleted attachments for a channel or DM conversation,
-- newest first, with sender info. Supports offset-based pagination.
create or replace function get_channel_media(
  p_channel_id      uuid    default null,
  p_conversation_id uuid    default null,
  p_limit           int     default 50,
  p_offset          int     default 0
)
returns table (
  id               uuid,
  message_id       uuid,
  name             text,
  url              text,
  mime_type        text,
  size_bytes       bigint,
  created_at       timestamptz,
  msg_created_at   timestamptz,
  sender_id        uuid,
  sender_username  text,
  sender_full_name text,
  sender_avatar_url text
)
language plpgsql security definer
as $$
begin
  return query
  select
    a.id,
    a.message_id,
    a.name,
    a.url,
    a.mime_type,
    a.size_bytes,
    a.created_at,
    m.created_at         as msg_created_at,
    p.id                 as sender_id,
    p.username           as sender_username,
    p.full_name          as sender_full_name,
    p.avatar_url         as sender_avatar_url
  from attachments a
  join messages  m on a.message_id = m.id
  join profiles  p on m.sender_id  = p.id
  where m.is_deleted = false
    and (p_channel_id      is null or m.channel_id      = p_channel_id)
    and (p_conversation_id is null or m.conversation_id = p_conversation_id)
  order by m.created_at desc
  limit  p_limit
  offset p_offset;
end;
$$;
