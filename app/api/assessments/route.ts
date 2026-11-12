import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { apiError, badRequest, unauthorized } from '@/lib/api';
import { getActiveRound, pool, refreshRanking } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const viewer = await currentPlayer();
    if (!viewer) return unauthorized();
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const playerId = Number(body.playerId);
    if (!Number.isInteger(playerId) || playerId === viewer.id) return badRequest('เลือกเพื่อนที่ต้องการประเมิน');
    const target = await pool.query('SELECT id, positions FROM players WHERE id = $1', [playerId]);
    if (!target.rows[0]) return NextResponse.json({ error: 'ไม่พบผู้เล่นที่เลือก' }, { status: 404 });
    const round = await getActiveRound();
    const isGoalkeeper = String(target.rows[0].positions || '').toUpperCase().split(/[\/,\s]+/).includes('GK');
    const keys = isGoalkeeper
      ? ["keeper_cutting","keeper_triangle","keeper_high_ball","keeper_low_ball","keeper_reflex","keeper_distribution"]
      : ["pace","passing","dribbling","shooting","defending","physicality"];
    const scores = keys.map(key => Number(body[key]));
    if (scores.some(score => !Number.isInteger(score) || score < 1 || score > 10)) {
      return badRequest('คะแนนทุกด้านต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 10');
    }
    const columns = keys;
    const placeholders = scores.map((_, index) => `$${index + 4}`);
    await pool.query(
      `INSERT INTO player_assessments
       (round_id, evaluator_id, player_id, ${columns.join(', ')}, updated_at)
       VALUES ($1,$2,$3,${placeholders.join(', ')},NOW())
       ON CONFLICT (round_id, evaluator_id, player_id) DO UPDATE SET
         ${columns.map(column => `${column}=EXCLUDED.${column}`).join(', ')}, updated_at=NOW()`,
      [round.id, viewer.id, playerId, ...scores]
    );
    await refreshRanking(round.id);
    return NextResponse.json({ ok: true, message: 'บันทึกคะแนนแล้ว คะแนนในตารางอันดับอัปเดตทันที' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
