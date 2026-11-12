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
      `SELECT p.id, p.name, p.positions, r.weighted_score, r.pace, r.passing,
        r.dribbling, r.shooting, r.defending, r.physicality, r.keeper_cutting, r.keeper_triangle, r.keeper_high_ball, r.keeper_low_ball, r.keeper_reflex, r.keeper_distribution, r.assessor_count
       FROM player_rankings r JOIN players p ON p.id = r.player_id
       WHERE r.round_id = $1 ORDER BY r.weighted_score DESC, p.id`, [round.id]
    );
    let rank = 0;
    let previous: number | null = null;
    const ranking = rows.map((player, index) => {
      const weightedScore = Number(player.weighted_score);
      if (previous === null || weightedScore !== previous) rank = index + 1;
      previous = weightedScore;
      const award = index === rows.length - 1
        ? "Super Ballon d'Or"
        : index === rows.length - 2 ? "Ballon d'Or" : null;
      return { ...player, weighted_score: weightedScore, rank, award };
    });
    return NextResponse.json({ round, ranking }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
