-- Star channels and DMs
ALTER TABLE channel_members ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
ALTER TABLE dm_members ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

-- Pin messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES auth.users(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Unread counts for channels
CREATE OR REPLACE FUNCTION get_unread_counts(p_user_id UUID, p_workspace_id UUID)
RETURNS TABLE(channel_id UUID, unread_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT m.channel_id, COUNT(m.id)::BIGINT
  FROM messages m
  JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = p_user_id
  WHERE m.workspace_id = p_workspace_id
    AND m.is_deleted = FALSE
    AND m.sender_id != p_user_id
    AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::TIMESTAMPTZ)
  GROUP BY m.channel_id;
END;
$$;

-- Unread counts for DMs
CREATE OR REPLACE FUNCTION get_dm_unread_counts(p_user_id UUID, p_workspace_id UUID)
RETURNS TABLE(conversation_id UUID, unread_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT m.conversation_id, COUNT(m.id)::BIGINT
  FROM messages m
  JOIN dm_members dml ON dml.conversation_id = m.conversation_id AND dml.user_id = p_user_id
  WHERE m.workspace_id = p_workspace_id
    AND m.is_deleted = FALSE
    AND m.sender_id != p_user_id
    AND m.created_at > COALESCE(dml.last_read_at, '1970-01-01'::TIMESTAMPTZ)
  GROUP BY m.conversation_id;
END;
$$;

-- RLS for starring
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'channel_members' AND policyname = 'cm_star'
  ) THEN
    CREATE POLICY cm_star ON channel_members FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dm_members' AND policyname = 'dm_star'
  ) THEN
    CREATE POLICY dm_star ON dm_members FOR UPDATE USING (user_id = auth.uid());
  END IF;
END;
$$;
