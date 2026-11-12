import { pool } from './db';

const KEEP_WARM_INTERVAL_MS = 4 * 60 * 1000;
const globalForKeepWarm = globalThis as typeof globalThis & {
  __footballKeepWarmTimer?: NodeJS.Timeout;
};

export function startKeepWarm() {
  if (globalForKeepWarm.__footballKeepWarmTimer) return;

  const timer = setInterval(async () => {
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      console.error('Keep-warm database ping failed:', error);
    }
  }, KEEP_WARM_INTERVAL_MS);

  timer.unref();
  globalForKeepWarm.__footballKeepWarmTimer = timer;
}
