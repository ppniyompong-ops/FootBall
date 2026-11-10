import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { apiError, unauthorized } from '@/lib/api';
import { getActiveRound, pool } from '@/lib/db';
import { balanceTeams, type TeamPlayer } from '@/lib/teams';

export const runtime = 'nodejs';

export async function GET() {
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
    if (saved.length === players.length) {
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
