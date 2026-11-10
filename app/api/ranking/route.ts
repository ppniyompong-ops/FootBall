import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { apiError, unauthorized } from '@/lib/api';
import { getActiveRound, pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    if (!await currentPlayer()) return unauthorized();
    const round = await getActiveRound();
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.positions, r.weighted_score, r.fitness, r.passing,
        r.first_touch, r.shooting, r.ball_control, r.assessor_count
       FROM player_rankings r JOIN players p ON p.id = r.player_id
       WHERE r.round_id = $1 ORDER BY r.weighted_score DESC, p.id`, [round.id]
    );
    let rank = 0;
    let previous: number | null = null;
    const ranking = rows.map((player, index) => {
      const weightedScore = Number(player.weighted_score);
      if (previous === null || weightedScore !== previous) rank = index + 1;
      previous = weightedScore;
      return { ...player, weighted_score: weightedScore, rank };
    });
    return NextResponse.json({ round, ranking }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
