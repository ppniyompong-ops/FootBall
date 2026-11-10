export interface TeamPlayer {
  id: number;
  name: string;
  positions: string;
  weighted_score: number;
  team?: string | null;
}

export const teamSeparationPairs = [
  ['เช่', 'พอร์ช'],
  ['ปกป้อง', 'กังฟู']
] as const;

export function teamSeparationViolations(assignments: Array<{ name: string; team: unknown }>) {
  const teamByName = new Map(assignments.map(player => [player.name === 'ป้อง' ? 'ปกป้อง' : player.name, player.team]));
  return teamSeparationPairs.filter(([first, second]) => {
    const firstTeam = teamByName.get(first);
    return firstTeam !== undefined && firstTeam === teamByName.get(second);
  });
}

export function balanceTeams(players: TeamPlayer[]): {
  teamA: TeamPlayer[];
  teamB: TeamPlayer[];
  sumA: number;
  sumB: number;
  difference: number;
} {
  let best: { teamA: TeamPlayer[]; teamB: TeamPlayer[]; sumA: number; sumB: number; difference: number } | null = null;
  const chosen: number[] = [];
  const half = Math.floor(players.length / 2);
  const consider = () => {
    const teamA = chosen.map(index => players[index]);
    const selected = new Set(chosen);
    const teamB = players.filter((_, index) => !selected.has(index));
    if (teamSeparationViolations([
      ...teamA.map(player => ({ name: player.name, team: 'A' })),
      ...teamB.map(player => ({ name: player.name, team: 'B' }))
    ]).length) return;
    const sumA = teamA.reduce((sum, player) => sum + player.weighted_score, 0);
    const sumB = teamB.reduce((sum, player) => sum + player.weighted_score, 0);
    const difference = Math.abs(sumA - sumB);
    if (!best || difference < best.difference) best = { teamA, teamB, sumA, sumB, difference };
  };
  const search = (start: number, remaining: number) => {
    if (remaining === 0) return consider();
    for (let index = start; index <= players.length - remaining; index++) {
      chosen.push(index);
      search(index + 1, remaining - 1);
      chosen.pop();
    }
  };
  if (players.length) {
    chosen.push(0);
    search(1, Math.max(0, half - 1));
    chosen.pop();
  }
  return best || { teamA: [], teamB: [], sumA: 0, sumB: 0, difference: 0 };
}
