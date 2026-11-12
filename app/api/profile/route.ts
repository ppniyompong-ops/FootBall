import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { apiError, badRequest, unauthorized } from '@/lib/api';
import { getActiveRound, pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const viewer = await currentPlayer();
    if (!viewer) return unauthorized();
    const playerId = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isInteger(playerId)) return badRequest('รหัสผู้เล่นไม่ถูกต้อง');
    const round = await getActiveRound();
    const [player, own, orderedPlayers] = await Promise.all([
      pool.query(
        `SELECT p.id, p.name, p.positions, r.weighted_score, r.pace, r.passing,
          r.dribbling, r.shooting, r.defending, r.physicality, r.keeper_positioning, r.keeper_cutting, r.keeper_triangle, r.keeper_high_ball, r.keeper_low_ball, r.keeper_penalty, r.assessor_count
         FROM players p LEFT JOIN player_rankings r ON r.player_id = p.id AND r.round_id = $1
         WHERE p.id = $2`, [round.id, playerId]
      ),
      pool.query(
        `SELECT pace, passing, dribbling, shooting, defending, physicality, keeper_positioning, keeper_cutting, keeper_triangle, keeper_high_ball, keeper_low_ball, keeper_penalty
         FROM player_assessments WHERE round_id=$1 AND evaluator_id=$2 AND player_id=$3`,
        [round.id, viewer.id, playerId]
      ),
      pool.query(
        `SELECT p.id FROM player_rankings r JOIN players p ON p.id = r.player_id
         WHERE r.round_id = $1 ORDER BY r.weighted_score DESC, p.id`,
        [round.id]
      )
    ]);
    if (!player.rows[0]) return NextResponse.json({ error: 'ไม่พบผู้เล่น' }, { status: 404 });
    const position = orderedPlayers.rows.findIndex(row => Number(row.id) === playerId);
    const award = position === orderedPlayers.rows.length - 1
      ? "Super Ballon d'Or"
      : position === orderedPlayers.rows.length - 2 ? "Ballon d'Or" : null;
    return NextResponse.json({
      player: { ...player.rows[0], weighted_score: Number(player.rows[0].weighted_score || 0), award },
      myAssessment: own.rows[0] || null
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
