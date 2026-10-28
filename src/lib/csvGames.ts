// murder_mystery_games.csv(보드라이프·텀블벅·머미나우에서 모은 게임 목록)를 사이트 게임으로 바꾼다.
// 열은 순서가 아니라 머리글 이름으로 찾으므로 열이 늘거나 순서가 바뀌어도 된다.
// 값의 길이·형식은 firestore.rules의 validGame()을 통과하도록 여기서 맞춘다.
import type { Game, GameInput } from "../types";
import { categoryFromGenres } from "./category";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n") row.push(cell.replace(/\r$/, "")), rows.push(row), (row = []), (cell = "");
    else cell += c;
  }
  if (cell || row.length) row.push(cell.replace(/\r$/, "")), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

// 엑셀에서 저장한 CSV는 EUC-KR(CP949)일 수 있다. UTF-8로 읽어 깨진 글자가 나오면 다시 읽는다
export async function readCsvFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("euc-kr").decode(buf) : utf8;
}

// 사이트 필드 -> CSV 머리글 후보 (앞의 것이 우선)
const COLUMNS = {
  name: ["게임명(한글)", "게임명", "이름"],
  nameEn: ["게임명(영문)"],
  publisher: ["출판사", "제작사"],
  designer: ["디자이너", "작가"],
  price: ["가격(원)", "가격"],
  year: ["출시연도", "출시일"],
  rating: ["평점(10점)"],
  ratingCount: ["평가수"],
  minPlayers: ["최소인원"],
  maxPlayers: ["최대인원"],
  playTime: ["플레이시간(분)", "플레이시간"],
  difficulty: ["난이도(1~5)", "난이도"],
  age: ["연령"],
  genres: ["장르"],
  language: ["언어의존도"],
  expansion: ["확장여부"],
  imageUrl: ["이미지URL", "표지"],
  boardlife: ["보드라이프"],
  source: ["출처URL", "링크"],
} as const;
type Column = keyof typeof COLUMNS;

export interface CsvGame {
  row: number; // CSV에서 몇 번째 줄인지 (머리글 = 1)
  game: GameInput;
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);
const toNum = (s: string) => {
  const n = Number(s.replace(/[,\s원]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};
const firstUrl = (s: string) => s.split(/\s+/).find((u) => /^https?:\/\/.+/i.test(u)) || "";
const blank = (s: string) => (s.trim() === "-" ? "" : s.trim());

// 아래 형식은 이미 사이트에 들어간 보드라이프 게임 260여 개(같은 CSV에서 옮긴 것)와 똑같이 맞춘 것이다.
// 바꾸면 기존 게임과 새 게임의 모양이 달라지므로, 바꿀 때는 사이트 데이터부터 확인한다.

// 출판사 열은 해외판까지 쉼표로 이어져 있다. 기존 게임처럼 첫 번째만 쓴다
function pickPublisher(s: string) {
  return clip((s.split(",")[0] || "").trim(), 100);
}

// 보드라이프 난이도(1~5) -> 2 미만 쉬움, 3 미만 보통, 그 이상 어려움
function toDifficulty(s: string) {
  const n = toNum(s);
  if (n == null) return ["쉬움", "보통", "어려움"].includes(s.trim()) ? s.trim() : "";
  return n < 2 ? "쉬움" : n < 3 ? "보통" : "어려움";
}

// 출시연도는 연도만("2014") 둔다. 날짜까지 있으면 YYYY-MM-DD로 맞춘다.
// (게임 수정 화면은 연도만 있는 값을 텍스트 칸으로 보여 줘야 지워지지 않는다 — SKILL.md 4단계)
function toReleaseDate(s: string) {
  const t = s.trim();
  if (/^\d{4}$/.test(t)) return t;
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(t)) {
    const [y, m, d] = t.split(/[./-]/);
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

// 사이트에 따로 칸이 없는 정보는 소개글에 한 줄씩 모은다
function describe(get: (c: Column) => string) {
  const rating = get("rating");
  const count = get("ratingCount");
  const lines = [
    get("nameEn") && `영문명: ${get("nameEn")}`,
    get("designer") && `디자이너: ${get("designer")}`,
    get("age") && `연령: ${get("age")}`,
    blank(get("language")) && `언어 의존도: ${blank(get("language"))}`,
    toNum(get("difficulty")) != null && `난이도: ${get("difficulty")} / 5`,
    get("expansion") === "확장" && "확장판",
    rating && `보드라이프 평점 ${Number(rating)} / 10${count ? ` (${count}명)` : ""}`,
  ].filter(Boolean);
  return clip(lines.join("\n"), 3000);
}

export function csvToGames(text: string, createdBy?: string): { games: CsvGame[]; skipped: number[]; missing: string[] } {
  const [header, ...rows] = parseCsv(text);
  const index = {} as Record<Column, number>;
  for (const key of Object.keys(COLUMNS) as Column[]) {
    index[key] = COLUMNS[key].map((h) => header.findIndex((x) => x.trim() === h)).find((i) => i >= 0) ?? -1;
  }
  const missing = (Object.keys(COLUMNS) as Column[]).filter((k) => index[k] < 0);
  if (index.name < 0) throw new Error(`게임 이름 열(${COLUMNS.name.join(", ")})을 찾지 못했어요`);

  const games: CsvGame[] = [];
  const skipped: number[] = [];
  rows.forEach((r, i) => {
    const get = (c: Column) => (index[c] >= 0 ? (r[index[c]] ?? "").trim() : "");
    const name = clip(get("name") || get("nameEn"), 100);
    if (!name) return skipped.push(i + 2);
    const rating = toNum(get("rating"));
    const minPlayers = toNum(get("minPlayers"));
    const genres = get("genres").split("/").map((g) => g.trim()).filter(Boolean).slice(0, 10);
    const game: GameInput = {
      name,
      publisher: pickPublisher(get("publisher")),
      price: toNum(get("price")),
      releaseDate: toReleaseDate(get("year")),
      rating: rating == null ? null : Math.round(rating * 5) / 10, // 10점 -> 5점, 소수 첫째 자리 (7.5 -> 3.8)
      minPlayers,
      maxPlayers: toNum(get("maxPlayers")) ?? minPlayers,
      playTime: toNum(get("playTime")),
      difficulty: toDifficulty(get("difficulty")),
      // 장르 열은 분류를 정하는 데 쓰고, 태그 자체는 화면에 보이지 않게 genres에만 남긴다
      category: categoryFromGenres(genres) ?? null,
      genres,
      imageUrl: clip(firstUrl(get("imageUrl")), 500),
      link: clip(firstUrl(get("boardlife")) || firstUrl(get("source")), 500),
      description: describe(get),
      ...(createdBy && { createdBy }),
    };
    games.push({ row: i + 2, game });
  });
  return { games, skipped, missing };
}

// ---------- 이미 사이트에 있는지 ----------

// 띄어쓰기·기호·대소문자와 "머더 미스터리 미니:" 같은 시리즈 머리말 차이를 무시한다
// (괄호 안은 지우지 않는다: "미스터리 로얄 (case:01)"과 "(case:02)"는 다른 게임)
export const normalizeName = (s = "") => s.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
const normalizeUrl = (s = "") => s.trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();

// 소개글의 "영문명: …" 줄 (기존 보드라이프 게임과 이 모듈이 만든 게임 모두 이 형식)
const englishName = (g: Pick<Game, "description">) => normalizeName(/^영문명: (.+)$/m.exec(g.description || "")?.[1]);
// 장르 이름일 뿐인 게임 이름은 다른 이름의 일부로 보지 않는다 ("느와르: 연역적 미스터리 게임" ≈ "미스터리" 방지)
const GENERIC = new Set(["미스터리", "미스테리", "머더미스터리", "추리", "추리게임", "살인사건", "탐정", "mystery"]);

export type MatchStatus = "new" | "similar" | "exists";
export interface Match extends CsvGame {
  status: MatchStatus;
  existing?: Game; // exists·similar일 때 비슷한 사이트 게임 (CSV 안의 중복이면 없음)
  reason?: string; // similar·exists인 까닭 (화면에 보여 준다)
}

export function matchExisting(rows: CsvGame[], existing: Game[]): Match[] {
  const byName = new Map(existing.map((g) => [normalizeName(g.name), g]));
  const byLink = new Map(existing.filter((g) => g.link).map((g) => [normalizeUrl(g.link), g]));
  const byEnglish = new Map<string, Game>(existing.flatMap((g) => (englishName(g) ? [[englishName(g), g] as const] : [])));
  // CSV 안에서 같은 이름(또는 영문명)이 두 번 나오면 뒤의 것은 exists
  const seen = new Set<string>();
  const seenEnglish = new Set<string>();
  return rows.map((r): Match => {
    const key = normalizeName(r.game.name);
    const en = englishName(r.game);
    const dup = seen.has(key) || (!!en && seenEnglish.has(en));
    seen.add(key);
    if (en) seenEnglish.add(en);
    if (byName.has(key)) return { ...r, status: "exists", existing: byName.get(key), reason: "이름이 같음" };
    const sameLink = r.game.link ? byLink.get(normalizeUrl(r.game.link)) : undefined;
    if (sameLink) return { ...r, status: "exists", existing: sameLink, reason: "링크가 같음" };
    // 한글 이름은 다르지만 영문명이 같으면 같은 게임일 가능성이 크다
    // (예: "느와르: 연역적 미스터리 게임" / "느와르: 디덕티브 미스테리 게임", 둘 다 NOIR: Deductive Mystery Game)
    const sameEnglish = en ? byEnglish.get(en) : undefined;
    if (dup) return { ...r, status: "exists", existing: sameEnglish, reason: "CSV 안에서 중복" };
    if (sameEnglish) return { ...r, status: "similar", existing: sameEnglish, reason: "영문명이 같음" };
    // 한쪽 이름이 다른 쪽에 들어 있으면(예: "웬디, 어른이 되렴" ⊂ "머더 미스터리 미니: 웬디, 어른이 되렴") 사람이 판단하게 한다.
    // 짧은 이름이 긴 이름의 일부일 뿐인 경우를 줄이려고 짧은 쪽이 4자 이상·긴 쪽의 30% 이상일 때만 보고,
    // 여럿이 걸리면 가장 긴(가장 구체적인) 이름을 고른다
    let similar: Game | undefined;
    for (const g of existing) {
      const k = normalizeName(g.name);
      const [short, long] = k.length < key.length ? [k, key] : [key, k];
      const hit = !GENERIC.has(short) && short.length >= 4 && short.length >= long.length * 0.3 && long.includes(short);
      if (hit && (!similar || k.length > normalizeName(similar.name).length)) similar = g;
    }
    return similar ? { ...r, status: "similar", existing: similar, reason: "이름 일부가 같음" } : { ...r, status: "new" };
  });
}
