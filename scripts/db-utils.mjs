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
    `INSERT INTO player_rankings (
       round_id, player_id, weighted_score, pace, passing, dribbling, shooting, defending, physicality, keeper_cutting, keeper_triangle, keeper_high_ball, keeper_low_ball, keeper_reflex, keeper_distribution, assessor_count, calculated_at
     )
     SELECT $1, p.id,
       CASE WHEN UPPER(p.positions) ~ '(^|[/,[:space:]])GK($|[/,[:space:]])'
         THEN ROUND((
           COALESCE(AVG(a.keeper_cutting), 0) + COALESCE(AVG(a.keeper_triangle), 0) + COALESCE(AVG(a.keeper_high_ball), 0) + COALESCE(AVG(a.keeper_low_ball), 0) + COALESCE(AVG(a.keeper_reflex), 0) + COALESCE(AVG(a.keeper_distribution), 0)
         ) / 6.0, 2)
         ELSE ROUND((
           COALESCE(AVG(a.pace), 0) + COALESCE(AVG(a.passing), 0) + COALESCE(AVG(a.dribbling), 0) + COALESCE(AVG(a.shooting), 0) + COALESCE(AVG(a.defending), 0) + COALESCE(AVG(a.physicality), 0)
         ) / 6.0, 2)
       END,
       ROUND(COALESCE(AVG(a.pace), 0), 2),
       ROUND(COALESCE(AVG(a.passing), 0), 2),
       ROUND(COALESCE(AVG(a.dribbling), 0), 2),
       ROUND(COALESCE(AVG(a.shooting), 0), 2),
       ROUND(COALESCE(AVG(a.defending), 0), 2),
       ROUND(COALESCE(AVG(a.physicality), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_cutting), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_triangle), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_high_ball), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_low_ball), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_reflex), 0), 2),
       ROUND(COALESCE(AVG(a.keeper_distribution), 0), 2),
       COUNT(a.id)::INTEGER,
       NOW()
     FROM players p
     LEFT JOIN player_assessments a
       ON a.player_id = p.id AND a.round_id = $1
     GROUP BY p.id
     ON CONFLICT (round_id, player_id) DO UPDATE SET
       weighted_score = EXCLUDED.weighted_score,
       pace = EXCLUDED.pace,
       passing = EXCLUDED.passing,
       dribbling = EXCLUDED.dribbling,
       shooting = EXCLUDED.shooting,
       defending = EXCLUDED.defending,
       physicality = EXCLUDED.physicality,
       keeper_cutting = EXCLUDED.keeper_cutting,
       keeper_triangle = EXCLUDED.keeper_triangle,
       keeper_high_ball = EXCLUDED.keeper_high_ball,
       keeper_low_ball = EXCLUDED.keeper_low_ball,
       keeper_reflex = EXCLUDED.keeper_reflex,
       keeper_distribution = EXCLUDED.keeper_distribution,
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
