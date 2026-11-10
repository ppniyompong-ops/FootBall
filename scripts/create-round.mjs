import { pool, refreshRanking } from './db-utils.mjs';

const title = process.argv.slice(2).join(' ').trim();

try {
  if (!title) throw new Error('Usage: npm run round:new -- "รอบที่ 2"');
  const client = await pool.connect();
  let roundId;
  try {
    await client.query('BEGIN');
    await client.query('UPDATE assessment_rounds SET is_active = FALSE WHERE is_active = TRUE');
    const inserted = await client.query(
      'INSERT INTO assessment_rounds (title, is_active) VALUES ($1, TRUE) RETURNING id',
      [title]
    );
    roundId = inserted.rows[0].id;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await refreshRanking(roundId);
  console.log(`Created ${title} (round ${roundId}). Previous rounds and assessments remain available.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
