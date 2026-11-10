import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { apiError, unauthorized } from '@/lib/api';
import { getActiveRound, pool } from '@/lib/db';

export const runtime = 'nodejs';

interface TeamPlayer { id: number; name: string; positions: string; weighted_score: number }

export async function GET() {
  try {
    if (!await currentPlayer()) return unauthorized();
    const round = await getActiveRound();
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.positions, r.weighted_score
       FROM players p LEFT JOIN player_rankings r ON r.player_id=p.id AND r.round_id=$1
       ORDER BY RANDOM()`, [round.id]
    );
    const players: TeamPlayer[] = rows.map(player => ({ ...player, id: Number(player.id), weighted_score: Number(player.weighted_score || 0) }));
    let best: { teamA: TeamPlayer[]; teamB: TeamPlayer[]; sumA: number; sumB: number; difference: number } | null = null;
    const chosen: number[] = [];
    const half = Math.floor(players.length / 2);
    const consider = () => {
      const teamA = chosen.map(index => players[index]);
      const selected = new Set(chosen);
      const teamB = players.filter((_, index) => !selected.has(index));
      const sumA = teamA.reduce((sum, player) => sum + player.weighted_score, 0);
      const sumB = teamB.reduce((sum, player) => sum + player.weighted_score, 0);
      const difference = Math.abs(sumA - sumB);
      if (!best || difference < best.difference) best = { teamA, teamB, sumA, sumB, difference };
    };
    const search = (start: number, remaining: number) => {
      if (remaining === 0) return consider();
      for (let i = start; i <= players.length - remaining; i++) {
        chosen.push(i);
        search(i + 1, remaining - 1);
        chosen.pop();
      }
    };
    if (players.length) {
      chosen.push(0);
      search(1, Math.max(0, half - 1));
      chosen.pop();
    }
    const result = best || { teamA: [], teamB: [], sumA: 0, sumB: 0, difference: 0 };
    return NextResponse.json({ round, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
