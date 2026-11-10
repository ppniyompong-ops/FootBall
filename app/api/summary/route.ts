import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { apiError, unauthorized } from '@/lib/api';
import { getActiveRound, pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const viewer = await currentPlayer();
    if (!viewer) return unauthorized();
    const round = await getActiveRound();
    const [done, total, ranking] = await Promise.all([
      pool.query('SELECT COUNT(*)::INTEGER AS count FROM player_assessments WHERE round_id = $1 AND evaluator_id = $2', [round.id, viewer.id]),
      pool.query('SELECT GREATEST(COUNT(*)::INTEGER - 1, 0) AS total FROM players'),
      pool.query('SELECT rank FROM (SELECT player_id, RANK() OVER (ORDER BY weighted_score DESC) AS rank FROM player_rankings WHERE round_id = $1) r WHERE player_id = $2', [round.id, viewer.id])
    ]);
    return NextResponse.json({ player: viewer, round, completed: done.rows[0].count, total: Number(total.rows[0].total), myRank: ranking.rows[0]?.rank || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
