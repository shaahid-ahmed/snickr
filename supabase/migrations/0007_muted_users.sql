-- ── Muted users ────────────────────────────────────────────────────────────
-- Each row means: muter_id has muted muted_id (one-directional, personal)

CREATE TABLE IF NOT EXISTS muted_users (
  muter_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (muter_id, muted_id)
);

ALTER TABLE muted_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='muted_users' AND policyname='muted_select') THEN
    CREATE POLICY muted_select ON muted_users FOR SELECT USING (auth.uid() = muter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='muted_users' AND policyname='muted_insert') THEN
    CREATE POLICY muted_insert ON muted_users FOR INSERT WITH CHECK (auth.uid() = muter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='muted_users' AND policyname='muted_delete') THEN
    CREATE POLICY muted_delete ON muted_users FOR DELETE USING (auth.uid() = muter_id);
  END IF;
END;
$$;
