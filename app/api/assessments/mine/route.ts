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
      `SELECT player_id, pace, passing, dribbling, shooting, defending, physicality, keeper_positioning, keeper_cutting, keeper_triangle, keeper_high_ball, keeper_low_ball, keeper_penalty, updated_at
       FROM player_assessments WHERE round_id = $1 AND evaluator_id = $2`,
      [round.id, viewer.id]
    );
    return NextResponse.json({ assessments: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
