// CSV를 사이트 게임으로 바꿔 보고, 실제 사이트(Firestore 공개 REST)에 이미 있는 게임과 맞춰 본다. 아무것도 쓰지 않는다.
// 사용: node preview.mjs [csv 경로] [--module src/lib/csvGames.ts] [--json 결과.json]
// Node 22.18+ / 24 (TypeScript 모듈을 그대로 import)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const csvPath = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) || "murder_mystery_games.csv";
const here = path.dirname(fileURLToPath(import.meta.url));
const modPath = path.resolve(opt("--module") || (fs.existsSync("src/lib/csvGames.ts") ? "src/lib/csvGames.ts" : path.join(here, "../assets/csvGames.ts")));
const { csvToGames, matchExisting } = await import(pathToFileURL(modPath).href);

const URL = "https://firestore.googleapis.com/v1/projects/mahamuder/databases/(default)/documents/games?pageSize=300";
async function liveGames() {
  const out = [];
  let token = "";
  do {
    const res = await fetch(URL + (token ? `&pageToken=${token}` : ""));
    if (!res.ok) throw new Error(`Firestore ${res.status}`);
    const j = await res.json();
    for (const d of j.documents || []) {
      out.push({ id: d.name.split("/").pop(), name: d.fields?.name?.stringValue || "", link: d.fields?.link?.stringValue || "" });
    }
    token = j.nextPageToken || "";
  } while (token);
  return out;
}

const { games, skipped, missing } = csvToGames(fs.readFileSync(csvPath, "utf8"), "preview");
let existing = [];
try {
  existing = await liveGames();
} catch (e) {
  console.warn(`사이트 게임 목록을 못 읽었어요(${e.message}). 중복 검사 없이 봅니다. 네트워크가 막힌 샌드박스라면 밖에서 실행하세요.`);
}
const matched = matchExisting(games, existing);
const by = (s) => matched.filter((m) => m.status === s);

console.log(`모듈: ${path.relative(process.cwd(), modPath)}`);
console.log(`CSV ${games.length}행 (이름 없어 건너뜀 ${skipped.length}${skipped.length ? `: ${skipped.slice(0, 10).join(", ")}줄` : ""})`);
if (missing.length) console.log(`CSV에 없는 열: ${missing.join(", ")}`);
console.log(`사이트 게임 ${existing.length}개 → 새 게임 ${by("new").length} / 비슷한 이름 ${by("similar").length} / 이미 있음 ${by("exists").length}`);
console.log("\n[비슷한 이름 — 사람이 확인]");
for (const m of by("similar").slice(0, 60)) console.log(`  ${m.row}줄 ${m.game.name}  ≈  ${m.existing.name}  (${m.reason})`);
console.log("\n[새 게임 예시]");
for (const m of by("new").slice(0, 5)) console.log(" ", JSON.stringify(m.game));

// 규칙(firestore.rules validGame)을 넘을 값이 없는지 한 번 더 본다
const bad = games.filter(({ game: g }) =>
  g.name.length > 100 || (g.publisher || "").length > 100 || (g.description || "").length > 3000 ||
  [g.imageUrl, g.link].some((u) => u && (u.length > 500 || !/^https?:\/\/.+/.test(u))) || (g.genres || []).length > 10);
console.log(`\n규칙 위반 가능 행: ${bad.length}${bad.length ? " → " + bad.map((b) => b.row).join(", ") : ""}`);

const jsonOut = opt("--json");
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(matched, null, 2));
