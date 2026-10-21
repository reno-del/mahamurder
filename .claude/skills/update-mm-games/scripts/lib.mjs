// 공용 도구: CSV 읽기/쓰기, 이름 정규화, 느린 fetch
import fs from "node:fs";

export const HEADERS = [
  "게임명(한글)", "게임명(영문)", "출판사", "디자이너", "가격(원)", "출시연도", "평점(10점)", "평가수",
  "최소인원", "최대인원", "플레이시간(분)", "난이도(1~5)", "연령", "장르", "언어의존도", "확장여부",
  "이미지URL", "가격출처", "가격검색URL", "보드라이프", "출처URL",
];

export function parseCsv(text) {
  const s = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f.replace(/\r$/, "")); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

const cell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

// CSV를 {header, rows(객체 배열)}로 읽는다. 예전 20열 파일이면 출처URL 열을 빈 값으로 채운다.
export function readGames(path) {
  const [header, ...body] = parseCsv(fs.readFileSync(path, "utf8"));
  const rows = body.map((r) => Object.fromEntries(HEADERS.map((h) => [h, r[header.indexOf(h)] ?? ""])));
  return { header, rows };
}

export function writeGames(path, rows) {
  fs.writeFileSync(path, toCsv([HEADERS, ...rows.map((o) => HEADERS.map((h) => o[h] ?? ""))]));
}

// 비교용 이름: 괄호·기호·공백을 없애고 소문자로. "머더 미스터리"와 "머더미스터리"를 같게 본다.
export const norm = (s) =>
  (s || "").toLowerCase().normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "");

// 텀블벅 제목 같은 홍보 문구에서 이름 후보를 뽑는다: 〈〉<>「」『』[]"" 안의 글자.
export function bracketNames(title) {
  return [...(title || "").matchAll(/[<〈《「『\[“"']\s*([^>〉》」』\]”"']{2,40})\s*[>〉》」』\]”"']/g)].map((m) => m[1].trim());
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36" };

export async function get(url, { json = false, tries = 3 } = {}) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return json ? await r.json() : await r.text();
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.message}`);
      await sleep(800 * i);
    }
  }
}

// 동시에 n개씩 돌린다. 사이트에 부담을 주지 않게 작게 유지.
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i], i); } catch (e) { out[i] = { error: e.message }; }
      await sleep(150);
    }
  }));
  return out;
}

export const naverSearchUrl = (name) =>
  "https://search.shopping.naver.com/search/all?query=" + encodeURIComponent(name);

export function args(argv = process.argv.slice(2)) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) o[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] == null ? true : argv[++i];
    else o._.push(argv[i]);
  }
  return o;
}
