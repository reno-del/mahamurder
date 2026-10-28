import type { Game } from "../types";

export type Team = {
  ids: string[];
  /** 이 팀에서 정한 게임 */
  pick: Game;
  /** 이 팀이 할 수 있는 게임 수(정한 게임 포함) */
  options: number;
};

// 사람이 많을수록 경우의 수가 급격히 늘어나서, 팀 수별로 계산할 최대 인원을 둔다
export const MAX_PEOPLE: Record<number, number> = { 2: 16, 3: 12 };

/**
 * 사람들을 k팀으로 나누는 경우 중, 팀마다 "팀원 아무도 안 해 본, 팀 인원에 맞는 게임"이 하나씩
 * 서로 겹치지 않게 돌아가는 나누기를 좋은 순서로 limit개(splits)와 그런 나누기의 전체 수(total)를 돌려준다.
 * 순서: 팀마다 고를 수 있는 게임이 많은 쪽(가장 적은 팀 기준, 3개 이상은 같게 봄) → 팀 인원이 고른 쪽 → 정한 게임 점수 합.
 */
export function splitTeams({
  ids,
  games,
  k,
  played,
  score,
  minSize = 2,
  limit = 5,
}: {
  ids: string[];
  games: Game[];
  k: number;
  played: (id: string, g: Game) => boolean;
  /** 팀에게 이 게임이 얼마나 좋은지 (클수록 먼저) */
  score: (g: Game, team: string[]) => number;
  minSize?: number;
  limit?: number;
}): { splits: Team[][]; total: number } {
  const n = ids.length;
  if (n < k * minSize || n > (MAX_PEOPLE[k] ?? 0)) return { splits: [], total: 0 };

  // 게임마다 해 본 사람 비트마스크, 인원 정보가 있는 게임만
  const pool = games
    .filter((g) => g.minPlayers)
    .map((g) => ({
      g,
      mask: ids.reduce((m, id, i) => (played(id, g) ? m | (1 << i) : m), 0),
    }));

  // 팀(비트마스크)별 후보 게임, 점수 순
  const cache = new Map<number, Game[]>();
  const candidates = (mask: number, team: string[]) => {
    let list = cache.get(mask);
    if (!list) {
      const size = team.length;
      list = pool
        .filter(({ g, mask: m }) => !(m & mask) && g.minPlayers! <= size && size <= (g.maxPlayers || g.minPlayers!))
        .map(({ g }) => ({ g, s: score(g, team) }))
        .sort((a, b) => b.s - a.s)
        .map(({ g }) => g);
      cache.set(mask, list);
    }
    return list;
  };

  const results: { teams: Team[]; key: [number, number, number] }[] = [];
  const assign = new Array<number>(n);

  const evaluate = () => {
    const groups = Array.from({ length: k }, () => ({
      mask: 0,
      ids: [] as string[],
    }));
    assign.forEach((t, i) => {
      groups[t].mask |= 1 << i;
      groups[t].ids.push(ids[i]);
    });
    const lists = groups.map((t) => candidates(t.mask, t.ids));
    if (lists.some((l) => !l.length)) return;
    // 팀끼리 같은 게임을 고르지 않게, 팀마다 상위 몇 개 안에서 점수 합이 가장 큰 조합
    let best: Game[] | null = null;
    let bestScore = -Infinity;
    const chosen: Game[] = [];
    const pick = (t: number, sum: number) => {
      if (t === k) {
        if (sum > bestScore) [best, bestScore] = [[...chosen], sum];
        return;
      }
      for (const g of lists[t].slice(0, k + 2)) {
        if (chosen.includes(g)) continue;
        chosen.push(g);
        pick(t + 1, sum + score(g, groups[t].ids));
        chosen.pop();
      }
    };
    pick(0, 0);
    if (!best) return;
    const picks: Game[] = best;
    const sizes = groups.map((t) => t.ids.length);
    results.push({
      teams: groups.map((t, i) => ({
        ids: t.ids,
        pick: picks[i],
        options: lists[i].length,
      })),
      key: [Math.min(3, ...lists.map((l) => l.length)), Math.max(...sizes) - Math.min(...sizes), bestScore],
    });
  };

  // 팀 번호를 처음 나오는 순서대로 붙여(0, 1, 2…) 같은 나누기를 두 번 세지 않는다
  const counts = new Array<number>(k).fill(0);
  const walk = (i: number, used: number) => {
    if (i === n) {
      if (used === k) evaluate();
      return;
    }
    // 남은 사람으로 모든 팀을 최소 인원까지 채울 수 없으면 중단
    const need = counts.reduce((s, c, t) => s + (t < used ? Math.max(0, minSize - c) : 0), 0) + (k - used) * minSize;
    if (need > n - i) return;
    for (let t = 0; t <= Math.min(used, k - 1); t++) {
      assign[i] = t;
      counts[t]++;
      walk(i + 1, Math.max(used, t + 1));
      counts[t]--;
    }
  };
  walk(0, 0);

  const splits = results
    .sort((a, b) => b.key[0] - a.key[0] || a.key[1] - b.key[1] || b.key[2] - a.key[2])
    .slice(0, limit)
    .map((r) => r.teams);
  return { splits, total: results.length };
}
