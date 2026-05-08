-- ── Channel logo & archiving ─────────────────────────────────────────────
ALTER TABLE channels ADD COLUMN IF NOT EXISTS logo_url     TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_archived  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS archived_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ;

-- ── Message extras ─────────────────────────────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS poll_id UUID;  -- FK added after polls table

-- ── Blocked users ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='blocked_select') THEN
    CREATE POLICY blocked_select ON blocked_users FOR SELECT USING (auth.uid() = blocker_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='blocked_insert') THEN
    CREATE POLICY blocked_insert ON blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='blocked_delete') THEN
    CREATE POLICY blocked_delete ON blocked_users FOR DELETE USING (auth.uid() = blocker_id);
  END IF;
END;
$$;

-- ── Polls ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id)  ON DELETE CASCADE,
  question        TEXT NOT NULL,
  allows_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id  UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  position INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id    UUID NOT NULL REFERENCES polls(id)         ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES poll_options(id)  ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, option_id, user_id)
);

ALTER TABLE polls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='polls'        AND policyname='polls_select')        THEN CREATE POLICY polls_select        ON polls        FOR SELECT USING (TRUE);                                     END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='polls'        AND policyname='polls_insert')        THEN CREATE POLICY polls_insert        ON polls        FOR INSERT WITH CHECK (auth.uid() = created_by);             END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='poll_options' AND policyname='poll_options_select') THEN CREATE POLICY poll_options_select ON poll_options FOR SELECT USING (TRUE);                                     END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='poll_options' AND policyname='poll_options_insert') THEN CREATE POLICY poll_options_insert ON poll_options FOR INSERT WITH CHECK (TRUE);                                END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='poll_votes'   AND policyname='poll_votes_select')   THEN CREATE POLICY poll_votes_select   ON poll_votes   FOR SELECT USING (TRUE);                                    END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='poll_votes'   AND policyname='poll_votes_insert')   THEN CREATE POLICY poll_votes_insert   ON poll_votes   FOR INSERT WITH CHECK (auth.uid() = user_id);               END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='poll_votes'   AND policyname='poll_votes_delete')   THEN CREATE POLICY poll_votes_delete   ON poll_votes   FOR DELETE USING (auth.uid() = user_id);                    END IF;
END;
$$;

-- Now add FK from messages → polls (IF NOT EXISTS not supported on ADD CONSTRAINT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_messages_poll' AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT fk_messages_poll
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ── Google OAuth: auto-create profile on new auth.users row ───────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username  TEXT;
  final_username TEXT;
  suffix         INT := 0;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(NEW.email,'user'), '@', 1), '[^a-z0-9_]', '', 'g'))
  );
  IF LENGTH(base_username) < 2 THEN base_username := 'user'; END IF;

  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(COALESCE(NEW.email,''), '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;  -- email sign-ups already create their own profile

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
