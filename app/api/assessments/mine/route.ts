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
    const { rows } = await pool.query(
      `SELECT player_id, fitness, passing, first_touch, shooting, ball_control,
         keeper_distribution, keeper_cutting, keeper_high_ball, keeper_low_ball, keeper_reflex, updated_at
       FROM player_assessments WHERE round_id = $1 AND evaluator_id = $2`,
      [round.id, viewer.id]
    );
    return NextResponse.json({ assessments: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
