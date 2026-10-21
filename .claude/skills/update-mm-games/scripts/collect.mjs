// 세 사이트에서 머더미스터리 후보를 모아 CSV에 이미 있는지 표시한다.
// 사용: node collect.mjs --csv murder_mystery_games.csv --out <작업폴더> [--only boardlife,tumblbug,murmynow]
// 결과: <out>/candidates.json(전체 자료), <out>/candidates.md(사람/Claude가 훑어볼 요약)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readGames, norm, bracketNames, args } from "./lib.mjs";
import * as src from "./sources.mjs";

const a = args();
const csvPath = a.csv || "murder_mystery_games.csv";
const out = a.out || path.join(os.tmpdir(), "mm-update");
const only = new Set((a.only || "boardlife,tumblbug,murmynow").split(","));
fs.mkdirSync(out, { recursive: true });

const { header, rows } = readGames(csvPath);
const blIds = new Set(rows.map((r) => (r["보드라이프"].match(/game\/(\d+)/) || [])[1]).filter(Boolean));
const srcUrls = new Set(rows.flatMap((r) => r["출처URL"].split(/\s+/)).filter(Boolean));
const names = rows.flatMap((r) => [r["게임명(한글)"], r["게임명(영문)"]]).map(norm).filter((n) => n.length >= 2);
const nameSet = new Set(names);

// 홍보 문구에 흔한 말. 이것만으로는 같은 게임이라고 볼 수 없다(CSV에 "미스터리"라는 게임도 있음).
const GENERIC = new Set(["미스터리", "미스테리", "머더미스터리", "머더미스테리", "탐정", "추리", "살인", "살인사건", "크라임", "사건", "mystery", "murder", "murdermystery"]);
const stripPromo = (s) => (s || "").replace(/\d+\s*인(?:용)?|\d+\s*종|머더\s*미스[터테]리|보드\s*게임|추리\s*게임|협력형|정통파/g, " ");

// known: 이름이 그대로 있음 / maybe: 한쪽이 다른 쪽을 포함(4글자 이상, 흔한 말 제외) / new: 못 찾음
function match(...cands) {
  const ns = cands.filter(Boolean).flatMap((c) => [norm(c), norm(stripPromo(c))]).filter((n) => n.length >= 2);
  const hit = ns.find((n) => nameSet.has(n));
  if (hit) return { status: "known", matched: rows.find((r) => [r["게임명(한글)"], r["게임명(영문)"]].map(norm).includes(hit))["게임명(한글)"] };
  for (const n of ns) {
    if (n.length < 4 || GENERIC.has(n)) continue;
    const r = rows.find((r) => [r["게임명(한글)"], r["게임명(영문)"]].map(norm).some((m) => m.length >= 4 && !GENERIC.has(m) && (m.includes(n) || n.includes(m))));
    if (r) return { status: "maybe", matched: r["게임명(한글)"] };
  }
  // 시리즈 접두어 뒤의 이름("특선집 : PART 01 분가" ↔ "분가")이나 한두 글자 다른 표기("포루투나"↔"포르투나")
  for (const n of ns) {
    if (GENERIC.has(n)) continue;
    const r = rows.find((r) => [r["게임명(한글)"], r["게임명(영문)"]].some((name) => {
      const m = norm(name);
      if (m.length >= 3 && n.length >= 3 && similar(m, n) >= 0.75) return true;
      return name.split(/[:：\-–—]/).slice(1).map(norm).some((seg) => seg.length >= 2 && (seg === n || (n.length >= 3 && seg.endsWith(n))));
    }));
    if (r) return { status: "maybe", matched: r["게임명(한글)"] };
  }
  return { status: "new" };
}

function similar(x, y) {
  if (Math.abs(x.length - y.length) > Math.max(x.length, y.length) / 3) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

const result = { generatedAt: new Date().toISOString(), csv: path.resolve(csvPath), csvRows: rows.length, hasSourceColumn: header.includes("출처URL") };
const log = (...m) => console.error(...m);

if (only.has("boardlife")) {
  const hits = new Map();
  for (const k of src.BOARDLIFE_KEYWORDS) {
    for (const g of await src.boardlifeSearch(k).catch((e) => (log("보드라이프 검색 실패", k, e.message), []))) {
      if (!hits.has(g.id)) hits.set(g.id, { ...g, keywords: [] });
      hits.get(g.id).keywords.push(k);
    }
  }
  const fresh = [...hits.values()].filter((g) => !blIds.has(g.id));
  log(`보드라이프: 검색 ${hits.size}개 중 CSV에 없는 ${fresh.length}개 상세 읽는 중`);
  const det = await src.pool(fresh, 3, (g) => src.boardlifeDetail(g.id));
  result.boardlife = fresh.map((g, i) => ({ ...g, ...det[i], ...match(det[i]["게임명(한글)"], det[i]["게임명(영문)"]) }));
}

if (only.has("tumblbug")) {
  const all = new Map();
  for (const k of src.TUMBLBUG_KEYWORDS) {
    for (const p of await src.tumblbugSearch(k).catch((e) => (log("텀블벅 검색 실패", k, e.message), []))) all.set(p.permalink, p);
  }
  // 보드게임·TRPG 분류만. 출판·디지털게임 등은 실물 머더미스터리가 아닐 때가 많다.
  const games = [...all.values()].filter((p) => p.category === "board-games-and-trpg");
  result.tumblbug = games.map((p) => {
    const url = `https://tumblbug.com/${p.permalink}`;
    const inner = bracketNames(p.title);
    return { ...p, url, names: inner, ...(srcUrls.has(url) ? { status: "known", matched: "(출처URL 일치)" } : match(...inner, p.title)) };
  });
  log(`텀블벅: 검색 ${all.size}개 중 보드게임 분류 ${games.length}개`);
}

if (only.has("murmynow")) {
  const list = await src.murmynowList().catch((e) => (log("머미나우 목록 실패", e.message), []));
  const tagged = list.map((g) => {
    const url = `https://murmynow.com/goods/goods_view.php?goodsNo=${g.goodsNo}`;
    return { ...g, url, ...(srcUrls.has(url) ? { status: "known", matched: "(출처URL 일치)" } : match(g.name)) };
  });
  const need = tagged.filter((g) => g.status !== "known");
  log(`머미나우: 보드게임 ${list.length}개 중 상세 ${need.length}개 읽는 중`);
  const det = await src.pool(need, 3, (g) => src.murmynowDetail(g.goodsNo));
  need.forEach((g, i) => Object.assign(g, det[i]));
  result.murmynow = tagged;
}

// 같은 게임이 텀블벅과 머미나우에 둘 다 있으면 서로 표시해 둔다.
if (result.tumblbug && result.murmynow) {
  for (const m of result.murmynow) {
    const n = norm(m.name);
    if (n.length < 2) continue;
    const t = result.tumblbug.find((p) => (m.links || []).includes(p.url) || p.names.some((x) => norm(x) === n) || (n.length >= 4 && norm(p.title).includes(n)));
    if (t) { m.sameAs = t.url; t.sameAs = m.url; }
  }
}

fs.writeFileSync(path.join(out, "candidates.json"), JSON.stringify(result, null, 1));

const md = [`# 후보 (CSV ${rows.length}행, ${result.generatedAt})`, ""];
const sec = (title, list, line) => {
  if (!list) return;
  const show = list.filter((x) => x.status !== "known");
  md.push(`## ${title}: 새 후보 ${show.filter((x) => x.status === "new").length}, 확인 필요 ${show.filter((x) => x.status === "maybe").length}, 이미 있음 ${list.length - show.length}`, "");
  for (const x of show) md.push(`- [${x.status}${x.matched ? ` ≈ ${x.matched}` : ""}] ${line(x)}`);
  md.push("");
};
sec("보드라이프", result.boardlife, (g) => `${g["게임명(한글)"]} / ${g["게임명(영문)"]} (${g["출시연도"] || "?"}, ${g["최소인원"]}-${g["최대인원"]}인, ${g["확장여부"]}, 분류:${g._category || "-"}) id=${g.id} 검색어:${g.keywords.join("·")}${g._shortTitle ? ` — ${g._shortTitle.slice(0, 60)}` : ""}`);
sec("텀블벅", result.tumblbug, (p) => `${p.title} [${p.state}] ${p.creator} ${p.start?.slice(0, 10)} ${p.url}${p.sameAs ? ` (머미나우 ${p.sameAs})` : ""}`);
sec("머미나우", result.murmynow, (g) => `${g.name} (${g.players || "?"}, ${g.time || "?"}, ${g.publisher || g.author || "?"}, ${g.released || "?"}) ${g.url}${g.sameAs ? ` (텀블벅 ${g.sameAs})` : ""}`);
fs.writeFileSync(path.join(out, "candidates.md"), md.join("\n"));
console.log(`저장: ${path.join(out, "candidates.json")}\n요약: ${path.join(out, "candidates.md")}`);
