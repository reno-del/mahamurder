import type { Game, Profile } from "../types";

export const won = (n?: number | null) => (n || n === 0 ? `${Number(n).toLocaleString("ko-KR")}원` : "가격 미정");

export function ymd(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export function prettyDate(s?: string) {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${WEEK[dt.getDay()]})`;
}

export function stars(rating?: number | null) {
  const r = Math.round(Number(rating) || 0);
  return "★".repeat(r) + "☆".repeat(5 - r);
}

export const players = (g: Pick<Game, "minPlayers" | "maxPlayers">) =>
  !g.minPlayers
    ? "인원 미정"
    : g.minPlayers === g.maxPlayers || !g.maxPlayers
      ? `${g.minPlayers}인`
      : `${g.minPlayers}~${g.maxPlayers}인`;

export const playTime = (m?: number | null) =>
  !m ? "" : m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`;

// 예시 데이터의 "예시) " 접두어 제거
export const cleanName = (name?: string) => String(name || "").replace(/^예시\)\s*/, "");

// 닉네임(마이페이지에서 설정) > 구글 이름
export const displayName = (p?: Profile | null) => (p && (p.nickname || p.googleName)) || "";
