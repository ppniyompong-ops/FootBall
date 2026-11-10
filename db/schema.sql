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
  fitness SMALLINT NOT NULL CHECK (fitness BETWEEN 1 AND 10),
  passing SMALLINT NOT NULL CHECK (passing BETWEEN 1 AND 10),
  first_touch SMALLINT NOT NULL CHECK (first_touch BETWEEN 1 AND 10),
  shooting SMALLINT NOT NULL CHECK (shooting BETWEEN 1 AND 10),
  ball_control SMALLINT NOT NULL CHECK (ball_control BETWEEN 1 AND 10),
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
  assessor_count INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (round_id, player_id)
);

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
