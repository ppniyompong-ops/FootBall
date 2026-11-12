import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Set it to your Neon Postgres connection string.');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true
});

async function runSqlFile(file) {
  await pool.query(await readFile(path.join(process.cwd(), 'db', file), 'utf8'));
}

export async function initializeDatabase() {
  const client = await pool.connect();
  let roundId;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(784605)');
    await client.query(await readFile(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
    await client.query(await readFile(path.join(process.cwd(), 'db', 'seed.sql'), 'utf8'));
    const active = await client.query('SELECT id FROM assessment_rounds WHERE is_active = TRUE ORDER BY id DESC LIMIT 1');
    if (active.rows[0]) roundId = Number(active.rows[0].id);
    else {
      const inserted = await client.query('INSERT INTO assessment_rounds (title, is_active) VALUES ($1, TRUE) RETURNING id', ['รอบที่ 1']);
      roundId = Number(inserted.rows[0].id);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  await refreshRanking(roundId);
}

export async function refreshRanking(roundId) {
  await pool.query(
    `WITH position_weights AS (
       SELECT p.id,
         AVG(w.pace_weight) AS pace_weight,
         AVG(w.passing_weight) AS passing_weight,
         AVG(w.dribbling_weight) AS dribbling_weight,
         AVG(w.shooting_weight) AS shooting_weight,
         AVG(w.defending_weight) AS defending_weight,
         AVG(w.physicality_weight) AS physicality_weight
       FROM players p
       CROSS JOIN LATERAL regexp_split_to_table(UPPER(p.positions), '[/,[:space:]]+') AS pos(code)
       JOIN (VALUES
         ('ST',15,5,10,40,5,25), ('CF',15,10,15,35,5,20),
         ('LW',25,15,25,20,5,10), ('RW',25,15,25,20,5,10),
         ('LWF',25,15,25,20,5,10), ('RWF',25,15,25,20,5,10),
         ('CAM',10,25,25,20,5,15), ('AMF',10,25,25,20,5,15),
         ('CM',10,25,15,10,20,20),
         ('CDM',10,15,10,5,35,25), ('DM',10,15,10,5,35,25),
         ('CB',10,10,5,5,40,30),
         ('LB',20,15,10,5,25,25), ('RB',20,15,10,5,25,25),
         ('LWB',20,15,10,5,25,25), ('RWB',20,15,10,5,25,25)
       ) AS w(position_code, pace_weight, passing_weight, dribbling_weight, shooting_weight, defending_weight, physicality_weight)
         ON w.position_code = pos.code
       GROUP BY p.id
     )
     INSERT INTO player_rankings (
       round_id, player_id, weighted_score, pace, passing, dribbling, shooting, defending, physicality, keeper_positioning, keeper_cutting, keeper_kick, keeper_high_ball, keeper_low_ball, keeper_penalty, assessor_count, calculated_at
     )
     SELECT $1, p.id,
       CASE WHEN UPPER(p.positions) ~ '(^|[/,[:space:]])GK($|[/,[:space:]])'
         THEN ROUND((
           COALESCE(AVG(a.keeper_positioning),0) * 20 +
           COALESCE(AVG(a.keeper_cutting),0) * 15 +
           COALESCE(AVG(a.keeper_kick),0) * 15 +
           COALESCE(AVG(a.keeper_high_ball),0) * 15 +
           COALESCE(AVG(a.keeper_low_ball),0) * 20 +
           COALESCE(AVG(a.keeper_penalty),0) * 15
         ) / 10.0, 0)
         ELSE ROUND((
           COALESCE(AVG(a.pace),0) * COALESCE(pw.pace_weight,16.6667) +
           COALESCE(AVG(a.passing),0) * COALESCE(pw.passing_weight,16.6667) +
           COALESCE(AVG(a.dribbling),0) * COALESCE(pw.dribbling_weight,16.6667) +
           COALESCE(AVG(a.shooting),0) * COALESCE(pw.shooting_weight,16.6667) +
           COALESCE(AVG(a.defending),0) * COALESCE(pw.defending_weight,16.6667) +
           COALESCE(AVG(a.physicality),0) * COALESCE(pw.physicality_weight,16.6667)
         ) / 10.0, 0)
       END,
       ROUND(COALESCE(AVG(a.pace), 0), 2),
       ROUND(COALESCE(AVG(a.passing), 0), 2),
       ROUND(COALESCE(AVG(a.dribbling), 0), 2),
       ROUND(COALESCE(AVG(a.shooting), 0), 2),
       ROUND(COALESCE(AVG(a.defending), 0), 2),
       ROUND(COALESCE(AVG(a.physicality), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_positioning), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_cutting), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_kick), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_high_ball), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_low_ball), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_penalty), 0), 2),
       COUNT(a.id)::INTEGER,
       NOW()
     FROM players p
     LEFT JOIN position_weights pw ON pw.id = p.id
     LEFT JOIN player_assessments a ON a.player_id = p.id AND a.round_id = $1
     GROUP BY p.id, p.positions, pw.pace_weight, pw.passing_weight, pw.dribbling_weight,
       pw.shooting_weight, pw.defending_weight, pw.physicality_weight
     ON CONFLICT (round_id, player_id) DO UPDATE SET
       weighted_score = EXCLUDED.weighted_score,
       pace = EXCLUDED.pace,
       passing = EXCLUDED.passing,
       dribbling = EXCLUDED.dribbling,
       shooting = EXCLUDED.shooting,
       defending = EXCLUDED.defending,
       physicality = EXCLUDED.physicality,
       keeper_positioning = EXCLUDED.keeper_positioning,
       keeper_cutting = EXCLUDED.keeper_cutting,
       keeper_kick = EXCLUDED.keeper_kick,
       keeper_high_ball = EXCLUDED.keeper_high_ball,
       keeper_low_ball = EXCLUDED.keeper_low_ball,
       keeper_penalty = EXCLUDED.keeper_penalty,
       assessor_count = EXCLUDED.assessor_count,
       calculated_at = NOW()`,
    [roundId]
  );
}

export async function refreshAllRankings() {
  await initializeDatabase();
  const { rows } = await pool.query('SELECT id FROM assessment_rounds ORDER BY id');
  for (const { id } of rows) await refreshRanking(Number(id));
  return rows.length;
}
