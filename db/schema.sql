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
  pace SMALLINT CHECK (pace BETWEEN 1 AND 10),
  passing SMALLINT CHECK (passing BETWEEN 1 AND 10),
  dribbling SMALLINT CHECK (dribbling BETWEEN 1 AND 10),
  shooting SMALLINT CHECK (shooting BETWEEN 1 AND 10),
  defending SMALLINT CHECK (defending BETWEEN 1 AND 10),
  physicality SMALLINT CHECK (physicality BETWEEN 1 AND 10),
  fitness SMALLINT CHECK (fitness BETWEEN 1 AND 10),
  first_touch SMALLINT CHECK (first_touch BETWEEN 1 AND 10),
  ball_control SMALLINT CHECK (ball_control BETWEEN 1 AND 10),
  keeper_distribution SMALLINT CHECK (keeper_distribution BETWEEN 1 AND 10),
  keeper_positioning SMALLINT CHECK (keeper_positioning BETWEEN 1 AND 10),
  keeper_penalty SMALLINT CHECK (keeper_penalty BETWEEN 1 AND 10),
  keeper_cutting SMALLINT CHECK (keeper_cutting BETWEEN 1 AND 10),
  keeper_high_ball SMALLINT CHECK (keeper_high_ball BETWEEN 1 AND 10),
  keeper_low_ball SMALLINT CHECK (keeper_low_ball BETWEEN 1 AND 10),
  keeper_reflex SMALLINT CHECK (keeper_reflex BETWEEN 1 AND 10),
  keeper_kick SMALLINT CHECK (keeper_kick BETWEEN 1 AND 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_assessment CHECK (evaluator_id <> player_id),
  CONSTRAINT one_assessment_per_player_per_round UNIQUE (round_id, evaluator_id, player_id)
);

CREATE TABLE IF NOT EXISTS player_rankings (
  round_id INTEGER NOT NULL REFERENCES assessment_rounds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  weighted_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  pace NUMERIC(5,2) NOT NULL DEFAULT 0,
  passing NUMERIC(5,2) NOT NULL DEFAULT 0,
  dribbling NUMERIC(5,2) NOT NULL DEFAULT 0,
  shooting NUMERIC(5,2) NOT NULL DEFAULT 0,
  defending NUMERIC(5,2) NOT NULL DEFAULT 0,
  physicality NUMERIC(5,2) NOT NULL DEFAULT 0,
  fitness NUMERIC(5,2) NOT NULL DEFAULT 0,
  first_touch NUMERIC(5,2) NOT NULL DEFAULT 0,
  ball_control NUMERIC(5,2) NOT NULL DEFAULT 0,
  keeper_distribution NUMERIC(5,2) NOT NULL DEFAULT 0,
  keeper_positioning NUMERIC(5,2) NOT NULL DEFAULT 0,
  keeper_penalty NUMERIC(5,2) NOT NULL DEFAULT 0,
  keeper_kick NUMERIC(5,2) NOT NULL DEFAULT 0,
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
  ADD COLUMN IF NOT EXISTS pace SMALLINT CHECK (pace BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS dribbling SMALLINT CHECK (dribbling BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS defending SMALLINT CHECK (defending BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS physicality SMALLINT CHECK (physicality BETWEEN 1 AND 10),
  ALTER COLUMN fitness DROP NOT NULL,
  ALTER COLUMN passing DROP NOT NULL,
  ALTER COLUMN first_touch DROP NOT NULL,
  ALTER COLUMN shooting DROP NOT NULL,
  ALTER COLUMN ball_control DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS keeper_distribution SMALLINT CHECK (keeper_distribution BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_positioning SMALLINT CHECK (keeper_positioning BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_penalty SMALLINT CHECK (keeper_penalty BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_cutting SMALLINT CHECK (keeper_cutting BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_high_ball SMALLINT CHECK (keeper_high_ball BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_low_ball SMALLINT CHECK (keeper_low_ball BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_reflex SMALLINT CHECK (keeper_reflex BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS keeper_kick SMALLINT CHECK (keeper_kick BETWEEN 1 AND 10);

ALTER TABLE player_rankings
  ADD COLUMN IF NOT EXISTS pace NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dribbling NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defending NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS physicality NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_distribution NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_cutting NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_high_ball NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_low_ball NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_reflex NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_positioning NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_penalty NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keeper_kick NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Rename the roster entry without changing its player id or any related data.
-- If both names already exist, stop safely rather than merging or deleting scores.
DO $rename_player$
DECLARE
  old_player_exists BOOLEAN;
  new_player_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM players WHERE name = 'แปง') INTO old_player_exists;
  SELECT EXISTS (SELECT 1 FROM players WHERE name = 'โช') INTO new_player_exists;

  IF old_player_exists AND new_player_exists THEN
    RAISE EXCEPTION 'Cannot rename แปง to โช: both player records already exist. Resolve the duplicate manually; no scores were changed.';
  ELSIF old_player_exists THEN
    UPDATE players SET name = 'โช' WHERE name = 'แปง';
  END IF;
END
$rename_player$;

-- Add uniqueness guarantees without deleting or rewriting existing assessment,
-- ranking, or team-assignment rows. If legacy duplicates exist, fail safely so
-- they can be reviewed manually instead of silently discarding user data.
CREATE UNIQUE INDEX IF NOT EXISTS player_assessments_round_evaluator_player_unique
  ON player_assessments (round_id, evaluator_id, player_id);

CREATE UNIQUE INDEX IF NOT EXISTS player_rankings_round_player_unique
  ON player_rankings (round_id, player_id);

CREATE INDEX IF NOT EXISTS assessments_by_round_player
  ON player_assessments (round_id, player_id);
