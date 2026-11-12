import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { apiError, unauthorized } from '@/lib/api';
import { ensureDatabase, getActiveRound, pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const admin = await currentAdmin();
    if (!admin) return unauthorized();
    await ensureDatabase();
    const round = await getActiveRound();
    const { rows } = await pool.query(
      `SELECT a.id, evaluator.name AS evaluator_name, player.name AS player_name, player.positions AS player_positions,
         a.pace, a.passing, a.dribbling, a.shooting, a.defending, a.physicality,
         a.keeper_cutting, a.keeper_triangle, a.keeper_high_ball, a.keeper_low_ball, a.keeper_reflex, a.keeper_distribution,
         a.updated_at
       FROM player_assessments a
       JOIN players evaluator ON evaluator.id = a.evaluator_id
       JOIN players player ON player.id = a.player_id
       WHERE a.round_id = $1
       ORDER BY a.updated_at DESC, evaluator.name, player.name`,
      [round.id]
    );
    return NextResponse.json({ round, assessments: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
