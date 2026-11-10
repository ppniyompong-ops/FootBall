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

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function randomizeTeams(players: TeamPlayer[]) {
  const order = shuffled(players);
  const targetA = Math.floor(players.length / 2);
  const targetB = players.length - targetA;
  const teamA: TeamPlayer[] = [];
  const teamB: TeamPlayer[] = [];
  const assignmentByName = new Map<string, 'A' | 'B'>();
  const partnerByName = new Map<string, string>();
  for (const [first, second] of teamSeparationPairs) {
    partnerByName.set(first, second);
    partnerByName.set(second, first);
  }
  const normalize = (name: string) => name === 'ป้อง' ? 'ปกป้อง' : name;
  const previousA = new Set(players.filter(player => player.team === 'A').map(player => player.id));
  const previousB = new Set(players.filter(player => player.team === 'B').map(player => player.id));
  const hasPreviousSplit = previousA.size + previousB.size === players.length;

  const search = (index: number): boolean => {
    if (index === order.length) {
      if (hasPreviousSplit) {
        const sameOrientation = teamA.length === previousA.size && teamA.every(player => previousA.has(player.id));
        const swappedOrientation = teamA.length === previousB.size && teamA.every(player => previousB.has(player.id));
        if (sameOrientation || swappedOrientation) return false;
      }
      return true;
    }
    const remaining = order.length - index;
    const neededA = targetA - teamA.length;
    const neededB = targetB - teamB.length;
    if (neededA < 0 || neededB < 0 || neededA + neededB !== remaining) return false;

    const player = order[index];
    const name = normalize(player.name);
    const partner = partnerByName.get(name);
    const choices = shuffled(['A', 'B'] as const);
    for (const team of choices) {
      const selected = team === 'A' ? teamA : teamB;
      const capacity = team === 'A' ? targetA : targetB;
      if (selected.length >= capacity || (partner && assignmentByName.get(partner) === team)) continue;
      selected.push(player);
      assignmentByName.set(name, team);
      if (search(index + 1)) return true;
      selected.pop();
      assignmentByName.delete(name);
    }
    return false;
  };

  if (!search(0)) return balanceTeams(players);
  const sumA = teamA.reduce((sum, player) => sum + player.weighted_score, 0);
  const sumB = teamB.reduce((sum, player) => sum + player.weighted_score, 0);
  return { teamA, teamB, sumA, sumB, difference: Math.abs(sumA - sumB) };
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
