// candidates.json의 새 후보(new·maybe)를 CSV 행 초안으로 바꾼다. Claude가 이 초안을 검토해서 고친다.
// 사용: node draft.mjs --in <작업폴더>/candidates.json --out <작업폴더>/drafts.json [--no-prices]
// - 텀블벅·머미나우에 같은 게임이 있으면 한 행으로 합친다(머미나우 정보가 더 정돈되어 있어 우선).
// - 텀블벅 한 프로젝트에 <A><B>처럼 여러 게임이 있으면 게임마다 한 행.
// - 텀블벅 실패·취소·공개 전 프로젝트와 머미나우 "온라인" 표시 상품은 뺀다.
// - 각 초안의 _key로 review.json에서 빼거나 고친다(SKILL.md 참고).
import fs from "node:fs";
import { norm, naverSearchUrl, args, pool, get } from "./lib.mjs";

const a = args();
const c = JSON.parse(fs.readFileSync(a.in, "utf8"));
const drafts = [];
const fresh = (list) => (list || []).filter((x) => x.status !== "known");
const num = (s) => (String(s || "").match(/\d+/) || [""])[0];
// "4인", "5~6인", "4-5인용", "8+1인"(8명 + 진행자 1명) 같은 표기
const range = (s) => {
  const t = String(s || "");
  const plus = t.match(/(\d+)\s*\+\s*(\d+)\s*(?:인|명)/);
  if (plus) return [plus[1], String(+plus[1] + +plus[2])];
  const m = t.match(/(\d+)\s*(?:[~\-–]\s*(\d+))?\s*(?:인|명)/);
  return m ? [m[1], m[2] || m[1]] : ["", ""];
};
// 텀블벅·머미나우 후보는 "머더미스터리" 검색·분류에서 왔으므로 기본이 머더미스터리. 보드라이프는 검색어가 넓어서 제목으로 짐작.
const guessGenre = (text, fallback = "미스터리·추리") =>
  /머더|머미|murder/i.test(text) ? "머더미스터리" : /탐정|추리|detective/i.test(text) ? "추리·탐정" : fallback;
const base = { "가격(원)": "", "평점(10점)": "", "평가수": "", "난이도(1~5)": "", "연령": "-", "언어의존도": "", "확장여부": "본판", "가격출처": "", "보드라이프": "", "출처URL": "" };

for (const g of fresh(c.boardlife)) {
  const { id, title, keywords, status, matched, _category, _shortTitle, _bgg, ...row } = g;
  drafts.push({
    _key: `bl:${id}`, _status: status, _matched: matched, _note: `분류:${_category || "-"} 검색어:${keywords.join("·")} ${_shortTitle || ""}`.trim(),
    ...base, ...row, "장르": guessGenre(`${row["게임명(한글)"]} ${row["게임명(영문)"]}`), "가격검색URL": naverSearchUrl(row["게임명(한글)"]),
  });
}

// 텀블벅 선물 목록. 가격과, 이름 없는 프로젝트·묶음 프로젝트의 게임 이름을 찾는 데 쓴다.
const OK = /^(succeeded|ongoing_reached)/;
const tbByUrl = new Map((c.tumblbug || []).map((p) => [p.url, p]));
const linked = new Set(fresh(c.murmynow).map((m) => m.sameAs).filter(Boolean));
const needRewards = (c.tumblbug || []).filter((p) => linked.has(p.url) || (p.status !== "known" && OK.test(p.state)));
const rewards = new Map();
if (!a["no-prices"]) {
  const got = await pool(needRewards, 3, async (p) =>
    (await get(`https://tumblbug.com/api/v3/project/${p.uuid}/rewards?type=REGULAR`, { json: true })).body?.result || []);
  needRewards.forEach((p, i) => rewards.set(p.url, Array.isArray(got[i]) ? got[i] : []));
}
// 펀딩가: 게임 이름이 들어간 선물 → 없으면 후원자가 가장 많은 1만 원 이상 선물. 정가와 다를 수 있어 가격출처는 "텀블벅".
function tbPrice(url, name) {
  const r = (rewards.get(url) || []).filter((x) => x.money >= 10000);
  const named = name && r.filter((x) => norm(x.title).includes(norm(name)));
  const best = (named?.length ? named : r).sort((x, y) => y.backersCount - x.backersCount)[0];
  return best ? { price: String(best.money), reward: best.title } : {};
}
const rewardTitles = (url) => (rewards.get(url) || []).map((x) => `${x.title}(${x.money})`).join(" / ").slice(0, 300);

const usedTb = new Set();
for (const m of fresh(c.murmynow)) {
  if (m.error) continue;
  const tb = m.sameAs && tbByUrl.get(m.sameAs);
  if (tb) usedTb.add(tb.url);
  if (m.format === "온라인") continue; // 온라인 전용(웹·디스코드로 하는 게임)
  const [lo, hi] = range(m.players)[0] ? range(m.players) : range(tb?.title);
  const pr = !m.price && tb ? tbPrice(tb.url, m.name) : {};
  drafts.push({
    _key: `mn:${m.goodsNo}`, _status: m.status, _matched: m.matched,
    _note: [m.mode, m.short?.slice(0, 120), tb && `텀블벅: ${tb.title} [${tb.state}]`].filter(Boolean).join(" | "),
    ...base,
    // 머미나우는 퍼블리셔 칸이 비고 작가 칸에 제작사가 들어간 경우가 많다
    "게임명(한글)": m.name, "게임명(영문)": "", "출판사": m.publisher || m.author || tb?.creator || "-", "디자이너": m.author || "-",
    "가격(원)": m.price || pr.price || "", "가격출처": m.price ? "머미나우" : pr.price ? "텀블벅" : "", "출시연도": m.released?.slice(0, 4) || "",
    "최소인원": lo, "최대인원": hi, "플레이시간(분)": num(m.time), "장르": "머더미스터리",
    "이미지URL": m.image || tb?.cover || "", "가격검색URL": naverSearchUrl(m.name),
    "출처URL": [m.url, tb?.url].filter(Boolean).join(" "),
  });
}

const tbs = fresh(c.tumblbug).filter((p) => OK.test(p.state) && !usedTb.has(p.url));
for (const p of tbs) {
  const names = p.names.length ? p.names : [""];
  const [lo, hi] = range(p.title);
  names.forEach((name, j) => {
    const pr = name ? tbPrice(p.url, name) : {};
    const unsure = !name || names.length > 1;
    drafts.push({
      _key: `tb:${p.permalink}${names.length > 1 ? `#${j + 1}` : ""}`, _status: p.status, _matched: p.matched,
      _note: [`제목: ${p.title}`, `[${p.state}]`, p.short, !name && "이름을 정해야 함", pr.reward && `가격 기준 선물: ${pr.reward}`,
        unsure && rewards.has(p.url) && `선물: ${rewardTitles(p.url)}`].filter(Boolean).join(" | "),
      ...base,
      "게임명(한글)": name, "게임명(영문)": "", "출판사": p.creator || "-", "디자이너": "-",
      "가격(원)": pr.price || "", "가격출처": pr.price ? "텀블벅" : "", "출시연도": (p.end || p.start || "").slice(0, 4),
      "최소인원": lo, "최대인원": hi, "플레이시간(분)": "", "장르": guessGenre(p.title, "머더미스터리"),
      "이미지URL": p.cover || "", "가격검색URL": name ? naverSearchUrl(name) : "", "출처URL": p.url,
    });
  });
}

// 같은 이름의 초안(재펀딩, 텀블벅↔머미나우 이중 등록)을 서로 표시해 둔다. 하나만 남기면 된다.
const byName = new Map();
for (const d of drafts) {
  const n = norm(d["게임명(한글)"]);
  if (n.length < 2) continue;
  if (byName.has(n)) d._sameName = byName.get(n);
  else byName.set(n, d._key);
}

fs.writeFileSync(a.out, JSON.stringify(drafts, null, 1));
const by = (k) => drafts.filter((d) => d._key.startsWith(k)).length;
console.log(`초안 ${drafts.length}개 (보드라이프 ${by("bl:")}, 머미나우 ${by("mn:")}, 텀블벅 ${by("tb:")}) → ${a.out}`);
console.log(`이름 없는 초안 ${drafts.filter((d) => !d["게임명(한글)"]).length}개, maybe ${drafts.filter((d) => d._status === "maybe").length}개`);
