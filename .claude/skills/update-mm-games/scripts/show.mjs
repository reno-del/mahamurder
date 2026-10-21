// 초안을 한 줄씩 보여 준다(검토용). 기본은 짧게(메모 100자), --full이면 메모 전체.
// 사용: node show.mjs drafts.json [--only tb:|mn:|bl:] [--from 0 --to 80] [--full] [--noname]
//   --noname: 이름 없는 초안과 여러 게임 묶음(#n)만
import fs from "node:fs";
import { args } from "./lib.mjs";

const a = args();
let d = JSON.parse(fs.readFileSync(a._[0], "utf8"));
if (a.only) d = d.filter((x) => x._key.startsWith(a.only));
if (a.noname) d = d.filter((x) => !x["게임명(한글)"] || x._key.includes("#"));
const from = Number(a.from || 0), to = Number(a.to || from + 80);
console.log(`${d.length}개 중 ${from}~${Math.min(to, d.length) - 1}`);
d.slice(from, to).forEach((x, i) => {
  const p = x["최소인원"] ? `${x["최소인원"]}-${x["최대인원"]}인` : "?인";
  const note = a.full ? x._note || "" : (x._note || "").slice(0, 100);
  console.log(`${from + i}. ${x._key} [${x._status}${x._matched ? `≈${x._matched}` : ""}]${x._sameName ? ` (같은 이름: ${x._sameName})` : ""} ` +
    `${x["게임명(한글)"] || "(이름 없음)"}${x["게임명(영문)"] ? ` / ${x["게임명(영문)"]}` : ""} | ${p} ${x["플레이시간(분)"] || "?"}분 | ` +
    `${x["출판사"]} | ${x["출시연도"]} | ${x["가격(원)"] || "-"}원 | ${x["장르"]} | ${note}`);
});
