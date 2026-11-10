CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  positions TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade databases created by earlier app versions where players already
-- exists but does not yet have a positions column.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS positions TEXT NOT NULL DEFAULT 'ไม่ระบุ';

CREATE UNIQUE INDEX IF NOT EXISTS players_name_unique
  ON players (name);

-- Older installations may still require the legacy `pos` column on inserts.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'players'
      AND column_name = 'pos'
  ) THEN
    EXECUTE 'ALTER TABLE players ALTER COLUMN pos SET DEFAULT ''ไม่ระบุ''';
  END IF;
END
$migration$;

CREATE TABLE IF NOT EXISTS assessment_rounds (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_assessment_round
  ON assessment_rounds (is_active)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS player_assessments (
  id BIGSERIAL PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES assessment_rounds(id) ON DELETE CASCADE,
  evaluator_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  fitness SMALLINT CHECK (fitness BETWEEN 1 AND 10),
  passing SMALLINT CHECK (passing BETWEEN 1 AND 10),
  first_touch SMALLINT CHECK (first_touch BETWEEN 1 AND 10),
  shooting SMALLINT CHECK (shooting BETWEEN 1 AND 10),
  ball_control SMALLINT CHECK (ball_control BETWEEN 1 AND 10),
  keeper_distribution SMALLINT CHECK (keeper_distribution BETWEEN 1 AND 10),
  keeper_cutting SMALLINT CHECK (keeper_cutting BETWEEN 1 AND 10),
  keeper_high_ball SMALLINT CHECK (keeper_high_ball BETWEEN 1 AND 10),
  keeper_low_ball SMALLINT CHECK (keeper_low_ball BETWEEN 1 AND 10),
  keeper_reflex SMALLINT CHECK (keeper_reflex BETWEEN 1 AND 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_assessment CHECK (evaluator_id <> player_id),
  CONSTRAINT one_assessment_per_player_per_round UNIQUE (round_id, evaluator_id, player_id)
);

CREATE TABLE IF NOT EXISTS player_rankings (
  round_id INTEGER NOT NULL REFERENCES assessment_rounds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  weighted_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  fitness NUMERIC(5,2) NOT NULL DEFAULT 0,
  passing NUMERIC(5,2) NOT NULL DEFAULT 0,
  first_touch NUMERIC(5,2) NOT NULL DEFAULT 0,
  shooting NUMERIC(5,2) NOT NULL DEFAULT 0,
  ball_control NUMERIC(5,2) NOT NULL DEFAULT 0,
  keeper_distribution NUMERIC(5,2) NOT NULL DEFAULT 0,
  keeper_cutting NUMERIC(5,2) NOT NULL DEFAULT 0,
  keeper_high_ball NUMERIC(5,2) NOT NULL DEFAULT 0,
  keeper_low_ball NUMERIC(5,2) NOT NULL DEFAULT 0,
  keeper_reflex NUMERIC(5,2) NOT NULL DEFAULT 0,
  assessor_count INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (round_id, player_id)
);

CREATE TABLE IF NOT EXISTS team_assignments (
  round_id INTEGER NOT NULL REFERENCES assessment_rounds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team CHAR(1) NOT NULL CHECK (team IN ('A', 'B')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (round_id, player_id)
);

ALTER TABLE player_assessments
  ALTER COLUMN fitness DROP NOT NULL,
  ALTER COLUMN passing DROP NOT NULL,
  ALTER COLUMN first_touch DROP NOT NULL,
  ALTER COLUMN shooting DROP NOT NULL,
  ALTER COLUMN ball_control DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS keeper_distribution SMALLINT CHECK (keeper_distribution BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_cutting SMALLINT CHECK (keeper_cutting BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_high_ball SMALLINT CHECK (keeper_high_ball BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_low_ball SMALLINT CHECK (keeper_low_ball BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_reflex SMALLINT CHECK (keeper_reflex BETWEEN 1 AND 10);

ALTER TABLE player_rankings
  ADD COLUMN IF NOT EXISTS keeper_distribution NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_cutting NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_high_ball NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_low_ball NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_reflex NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Merge the duplicate roster entry into the canonical player while retaining
-- the newest non-duplicate assessment and any manual team assignment.
DO $merge_players$
DECLARE
  canonical_id INTEGER;
  duplicate_id INTEGER;
BEGIN
  SELECT id INTO canonical_id FROM players WHERE name = 'ปกป้อง' ORDER BY id LIMIT 1;
  SELECT id INTO duplicate_id FROM players WHERE name = 'ป้อง' ORDER BY id LIMIT 1;

  IF canonical_id IS NOT NULL AND duplicate_id IS NOT NULL THEN
    DELETE FROM player_assessments a
    WHERE CASE WHEN a.evaluator_id = duplicate_id THEN canonical_id ELSE a.evaluator_id END
        = CASE WHEN a.player_id = duplicate_id THEN canonical_id ELSE a.player_id END;

    DELETE FROM player_assessments
    WHERE ctid IN (
      SELECT ctid FROM (
        SELECT ctid,
          ROW_NUMBER() OVER (
            PARTITION BY round_id,
              CASE WHEN evaluator_id = duplicate_id THEN canonical_id ELSE evaluator_id END,
              CASE WHEN player_id = duplicate_id THEN canonical_id ELSE player_id END
            ORDER BY updated_at DESC NULLS LAST, ctid DESC
          ) AS duplicate_number
        FROM player_assessments
      ) ranked
      WHERE duplicate_number > 1
    );

    UPDATE player_assessments SET evaluator_id = canonical_id WHERE evaluator_id = duplicate_id;
    UPDATE player_assessments SET player_id = canonical_id WHERE player_id = duplicate_id;
    DELETE FROM player_rankings WHERE player_id = duplicate_id;
    DELETE FROM team_assignments old
    USING team_assignments kept
    WHERE old.round_id = kept.round_id
      AND old.player_id = duplicate_id
      AND kept.player_id = canonical_id;
    UPDATE team_assignments SET player_id = canonical_id WHERE player_id = duplicate_id;
    DELETE FROM players WHERE id = duplicate_id;
  END IF;
END
$merge_players$;

-- Bring forward unique keys that were absent from some legacy installations.
-- Keep the most recently updated assessment if an old database has duplicates.
DELETE FROM player_assessments older
USING player_assessments newer
WHERE older.round_id = newer.round_id
  AND older.evaluator_id = newer.evaluator_id
  AND older.player_id = newer.player_id
  AND (older.updated_at < newer.updated_at
       OR (older.updated_at = newer.updated_at AND older.ctid < newer.ctid));

CREATE UNIQUE INDEX IF NOT EXISTS player_assessments_round_evaluator_player_unique
  ON player_assessments (round_id, evaluator_id, player_id);

-- Rankings are a cache derived from assessments, so duplicate cache rows can
-- be discarded safely before adding the key used by the upsert query.
DELETE FROM player_rankings older
USING player_rankings newer
WHERE older.round_id = newer.round_id
  AND older.player_id = newer.player_id
  AND older.ctid < newer.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS player_rankings_round_player_unique
  ON player_rankings (round_id, player_id);

CREATE INDEX IF NOT EXISTS assessments_by_round_player
  ON player_assessments (round_id, player_id);
