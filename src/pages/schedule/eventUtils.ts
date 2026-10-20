import type { GameEvent, Profile } from "../../types";

export const count = (e: GameEvent) => Object.keys(e.participants || {}).length;

export const sortEv = (a: GameEvent, b: GameEvent) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));

export type StatusClass = "full" | "ok" | "open";
export function status(e: GameEvent): { cls: StatusClass; label: string } {
  const n = count(e);
  if (e.maxPlayers && n >= e.maxPlayers) return { cls: "full", label: "모집 완료" };
  if (n >= (e.minPlayers || 1)) return { cls: "ok", label: "진행 확정 · 추가 모집" };
  return { cls: "open", label: `${(e.minPlayers || 1) - n}명 더 필요` };
}

export function dday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const diff = Math.round((new Date(y, m - 1, d).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
  return diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

// 머더미스터리는 한 번만 플레이할 수 있으므로, 이미 해 본 참가자를 경고로 보여준다.
export function alreadyPlayed(e: GameEvent, profiles: Profile[]) {
  return Object.keys(e.participants || {}).filter((uid) => profiles.find((p) => p.id === uid)?.played?.[e.gameId]);
}
