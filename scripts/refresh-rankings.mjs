import { refreshAllRankings, pool } from './db-utils.mjs';

try {
  const rounds = await refreshAllRankings();
  console.log(`Ranking refresh complete for ${rounds} assessment round(s).`);
} catch (error) {
  console.error('Ranking refresh failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
