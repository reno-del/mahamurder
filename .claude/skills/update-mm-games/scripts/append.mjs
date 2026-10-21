// 새 행(JSON 배열, 키는 CSV 머리글)을 검사해서 CSV 끝에 붙인다.
// 사용: node append.mjs drafts.json --csv murder_mystery_games.csv [--review review.json] [--dry-run]
// - review.json: {"drop": ["tb:abc", "bl:8223", ...], "edit": {"tb:abc": {"게임명(한글)": "..."}}, "add": [행, ...]}
//   drop은 _key 그대로 적는다. 끝에 *를 붙이면 앞부분 일치("tb:mysteryparty*"는 mysteryparty2~7 모두).
//   add 행은 _key 없이 CSV 머리글만 쓰면 된다.
// - 출처URL 열이 없으면 만든다(기존 행은 빈 값). 기존 20개 열 순서는 그대로.
// - 보드라이프 주소나 이름이 이미 있는 행은 건너뛴다. 출처URL만 같은 것은 중복이 아니다
//   (텀블벅 한 프로젝트에서 여러 게임이 나오고, 머미나우 상품이 같은 텀블벅 주소를 가리키기도 한다).
// - 가격검색URL이 비어 있으면 한글 이름으로 채운다.
import fs from "node:fs";
import { HEADERS, readGames, writeGames, norm, naverSearchUrl, args } from "./lib.mjs";

const a = args();
const csvPath = a.csv || "murder_mystery_games.csv";
let input = JSON.parse(fs.readFileSync(a._[0], "utf8"));
if (a.review) {
  const rv = JSON.parse(fs.readFileSync(a.review, "utf8"));
  const drop = rv.drop || [];
  const hits = (k, key) => (k.endsWith("*") ? !!key?.startsWith(k.slice(0, -1)) : key === k);
  const missing = [...drop, ...Object.keys(rv.edit || {})].filter((k) => !input.some((d) => hits(k, d._key)));
  if (missing.length) console.log(`주의: 초안에 없는 키 ${missing.join(", ")}`);
  input = input
    .filter((d) => !drop.some((k) => hits(k, d._key)))
    .map((d) => {
      const e = rv.edit?.[d._key];
      // 이름을 고치면 가격검색URL도 새 이름으로 다시 만든다
      return e ? { ...d, ...e, ...(e["게임명(한글)"] && !e["가격검색URL"] ? { "가격검색URL": "" } : {}) } : d;
    })
    .concat(rv.add || []);
}
const { rows } = readGames(csvPath);

const GENRES = ["머더미스터리", "미스터리·추리", "추리·탐정", "소셜 디덕션"];
const LANG = ["", "없음", "간단", "적당", "많음", "불가"];
const NUM = ["가격(원)", "출시연도", "평점(10점)", "평가수", "최소인원", "최대인원", "플레이시간(분)", "난이도(1~5)"];

const seen = { bl: new Set(), name: new Set() };
const remember = (r) => {
  if (r["보드라이프"]) seen.bl.add(r["보드라이프"]);
  seen.name.add(norm(r["게임명(한글)"]));
};
rows.forEach(remember);

const added = [], skipped = [], problems = [];
for (const raw of input) {
  const unknown = Object.keys(raw).filter((k) => !HEADERS.includes(k) && !k.startsWith("_"));
  const r = Object.fromEntries(HEADERS.map((h) => [h, raw[h] == null ? "" : String(raw[h]).trim()]));
  const name = r["게임명(한글)"];
  const errs = [];
  if (unknown.length) errs.push(`모르는 열: ${unknown.join(", ")}`);
  if (!name) errs.push("게임명(한글) 없음");
  if (!r["보드라이프"] && !r["출처URL"]) errs.push("보드라이프와 출처URL이 모두 비어 있음");
  for (const k of NUM) if (r[k] && !/^\d+(\.\d+)?$/.test(r[k])) errs.push(`${k}가 숫자가 아님: ${r[k]}`);
  if (r["최소인원"] && r["최대인원"] && +r["최소인원"] > +r["최대인원"]) errs.push("최소인원 > 최대인원");
  if (!["본판", "확장"].includes(r["확장여부"])) errs.push(`확장여부는 본판/확장: ${r["확장여부"]}`);
  if (!LANG.includes(r["언어의존도"])) errs.push(`언어의존도 값: ${r["언어의존도"]}`);
  const g = r["장르"].split(" / ").filter(Boolean);
  if (!g.length || g.some((x) => !GENRES.includes(x))) errs.push(`장르는 ${GENRES.join(", ")} 중에서 " / "로: ${r["장르"]}`);
  if (errs.length) { problems.push(`${name || "(이름 없음)"}: ${errs.join("; ")}`); continue; }

  const dup = (r["보드라이프"] && seen.bl.has(r["보드라이프"]) && "보드라이프 주소")
    || (seen.name.has(norm(name)) && "이름");
  if (dup) { skipped.push(`${name} (${dup} 중복)`); continue; }

  if (!r["가격검색URL"]) r["가격검색URL"] = naverSearchUrl(name);
  if (!r["연령"]) r["연령"] = "-";
  added.push(r);
  remember(r);
}

if (problems.length) {
  console.log(`형식 문제로 하나도 쓰지 않았어요. 고친 뒤 다시 실행하세요:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
if (!a["dry-run"]) writeGames(csvPath, [...rows, ...added]);
console.log(`${a["dry-run"] ? "[미리보기] " : ""}추가 ${added.length}개, 건너뜀 ${skipped.length}개, CSV ${rows.length} → ${rows.length + added.length}행`);
for (const r of added) console.log(`+ ${r["게임명(한글)"]} | ${r["장르"]} | ${r["보드라이프"] || r["출처URL"]}`);
for (const s of skipped) console.log(`= ${s}`);
