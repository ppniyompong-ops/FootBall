import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { currentPlayer } from '@/lib/auth';
import { apiError, badRequest, unauthorized } from '@/lib/api';
import { getActiveRound, pool } from '@/lib/db';
import { balanceTeams, type TeamPlayer } from '@/lib/teams';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (!await currentPlayer()) return unauthorized();
    const round = await getActiveRound();
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.positions, r.weighted_score, t.team
       FROM players p
       LEFT JOIN player_rankings r ON r.player_id=p.id AND r.round_id=$1
       LEFT JOIN team_assignments t ON t.player_id=p.id AND t.round_id=$1
       ORDER BY RANDOM()`, [round.id]
    );
    const players: TeamPlayer[] = rows.map(player => ({ ...player, id: Number(player.id), weighted_score: Number(player.weighted_score || 0) }));
    const saved = players.filter(player => player.team === 'A' || player.team === 'B');
    const reroll = Number(request.nextUrl.searchParams.get('run') || 0) > 0;
    if (saved.length === players.length && !reroll) {
      const teamA = players.filter(player => player.team === 'A');
      const teamB = players.filter(player => player.team === 'B');
      const sumA = teamA.reduce((sum, player) => sum + player.weighted_score, 0);
      const sumB = teamB.reduce((sum, player) => sum + player.weighted_score, 0);
      return NextResponse.json({ round, teamA, teamB, sumA, sumB, difference: Math.abs(sumA - sumB), customized: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const result = balanceTeams(players);
    return NextResponse.json({ round, ...result, customized: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: NextRequest) {
  let client: PoolClient | undefined;
  let transactionStarted = false;
  try {
    if (!await currentPlayer()) return unauthorized();
    const round = await getActiveRound();
    const body = await request.json().catch(() => ({})) as { assignments?: Array<{ id?: unknown; team?: unknown }> };
    if (!Array.isArray(body.assignments)) return badRequest('ทีมที่ส่งมาไม่ถูกต้อง');

    const roster = await pool.query('SELECT id FROM players ORDER BY id');
    const rosterIds = new Set(roster.rows.map(row => Number(row.id)));
    const assignments = body.assignments.map(item => ({ id: Number(item?.id), team: item?.team }));
    const assignmentIds = new Set(assignments.map(item => item.id));
    const teamA = assignments.filter(item => item.team === 'A').length;
    const teamB = assignments.filter(item => item.team === 'B').length;
    if (
      assignments.length !== rosterIds.size ||
      assignmentIds.size !== rosterIds.size ||
      assignments.some(item => !rosterIds.has(item.id) || (item.team !== 'A' && item.team !== 'B')) ||
      Math.abs(teamA - teamB) > 1
    ) return badRequest('ต้องจัดผู้เล่นทุกคนให้ครบ และจำนวนสองทีมต้องต่างกันไม่เกิน 1 คน');

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('DELETE FROM team_assignments WHERE round_id = $1', [round.id]);
    for (const item of assignments) {
      await client.query(
        'INSERT INTO team_assignments (round_id, player_id, team, updated_at) VALUES ($1, $2, $3, NOW())',
        [round.id, item.id, item.team]
      );
    }
    await client.query('COMMIT');
    transactionStarted = false;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (client && transactionStarted) await client.query('ROLLBACK').catch(() => {});
    return apiError(error);
  } finally { client?.release(); }
}
