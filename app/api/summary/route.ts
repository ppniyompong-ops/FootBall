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
    const [done, overall, ranking] = await Promise.all([
      pool.query('SELECT COUNT(*)::INTEGER AS count FROM player_assessments WHERE round_id = $1 AND evaluator_id = $2', [round.id, viewer.id]),
      pool.query('SELECT ROUND(AVG(weighted_score), 2) AS average FROM player_rankings WHERE round_id = $1 AND assessor_count > 0', [round.id]),
      pool.query('SELECT rank FROM (SELECT player_id, RANK() OVER (ORDER BY weighted_score DESC) AS rank FROM player_rankings WHERE round_id = $1) r WHERE player_id = $2', [round.id, viewer.id])
    ]);
    return NextResponse.json({ player: viewer, round, completed: done.rows[0].count, total: 17, overallAverage: Number(overall.rows[0].average || 0), myRank: ranking.rows[0]?.rank || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
