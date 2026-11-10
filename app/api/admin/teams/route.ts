import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { currentAdmin } from '@/lib/auth';
import { apiError, badRequest, unauthorized } from '@/lib/api';
import { ensureDatabase, getActiveRound, pool } from '@/lib/db';
import { balanceTeams, teamSeparationViolations, type TeamPlayer } from '@/lib/teams';

export const runtime = 'nodejs';

async function getPlayers(roundId: number): Promise<TeamPlayer[]> {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.positions, COALESCE(r.weighted_score, 0) AS weighted_score,
       t.team
     FROM players p
     LEFT JOIN player_rankings r ON r.player_id = p.id AND r.round_id = $1
     LEFT JOIN team_assignments t ON t.player_id = p.id AND t.round_id = $1
     ORDER BY p.name`,
    [roundId]
  );
  return rows.map(row => ({ ...row, id: Number(row.id), weighted_score: Number(row.weighted_score) }));
}

export async function GET() {
  try {
    const admin = await currentAdmin();
    if (!admin) return unauthorized();
    await ensureDatabase();
    const round = await getActiveRound();
    const players = await getPlayers(round.id);
    const saved = players.filter(player => player.team === 'A' || player.team === 'B');
    const savedAssignments = players.map(player => ({ id: player.id, name: player.name, positions: player.positions, team: player.team as 'A' | 'B' }));
    const savedIsValid = saved.length === players.length && teamSeparationViolations(savedAssignments).length === 0;
    const balanced = savedIsValid ? null : balanceTeams(players);
    const assignments = balanced
      ? [...balanced.teamA.map(player => ({ id: player.id, name: player.name, positions: player.positions, team: 'A' as const })), ...balanced.teamB.map(player => ({ id: player.id, name: player.name, positions: player.positions, team: 'B' as const }))]
      : savedAssignments;
    return NextResponse.json({ round, customized: savedIsValid, assignments }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: NextRequest) {
  let client: PoolClient | undefined;
  let transactionStarted = false;
  try {
    const admin = await currentAdmin();
    if (!admin) return unauthorized();
    await ensureDatabase();
    const round = await getActiveRound();
    const body = await request.json().catch(() => ({})) as { assignments?: Array<{ id?: unknown; team?: unknown }> };
    if (!Array.isArray(body.assignments)) return badRequest('ทีมที่ส่งมาไม่ถูกต้อง');

    const roster = await pool.query('SELECT id, name FROM players ORDER BY id');
    const rosterIds = new Set(roster.rows.map(row => Number(row.id)));
    const namesById = new Map(roster.rows.map(row => [Number(row.id), String(row.name)]));
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
    const separationConflicts = teamSeparationViolations(assignments.map(item => ({ name: namesById.get(item.id) || '', team: item.team })));
    if (separationConflicts.length) {
      return badRequest(`ต้องแยก ${separationConflicts.map(pair => pair.join(' กับ ')).join(' และ ')} ไว้คนละทีม`);
    }

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
