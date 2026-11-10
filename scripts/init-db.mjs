import { initializeDatabase, pool } from './db-utils.mjs';

try {
  await initializeDatabase();
  console.log('Neon schema and seed data are ready.');
} finally {
  await pool.end();
}
