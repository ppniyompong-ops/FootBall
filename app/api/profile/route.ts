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
    const [player, own] = await Promise.all([
      pool.query(
        `SELECT p.id, p.name, p.positions, r.weighted_score, r.fitness, r.passing,
          r.first_touch, r.shooting, r.ball_control, r.assessor_count
         FROM players p LEFT JOIN player_rankings r ON r.player_id = p.id AND r.round_id = $1
         WHERE p.id = $2`, [round.id, playerId]
      ),
      pool.query(
        `SELECT fitness, passing, first_touch, shooting, ball_control
         FROM player_assessments WHERE round_id=$1 AND evaluator_id=$2 AND player_id=$3`,
        [round.id, viewer.id, playerId]
      )
    ]);
    if (!player.rows[0]) return NextResponse.json({ error: 'ไม่พบผู้เล่น' }, { status: 404 });
    return NextResponse.json({
      player: { ...player.rows[0], weighted_score: Number(player.rows[0].weighted_score || 0) },
      myAssessment: own.rows[0] || null
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
