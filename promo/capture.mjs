// 데모 모드(npm run dev:demo, 포트 5173)에 예시 데이터를 넣고 화면을 캡처해 public/shots/에 저장합니다.
// 게임 정보는 저장소 루트의 murder_mystery_games.csv에서 읽습니다.
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const OUT = path.resolve("public/shots");
const BROWSER =
  process.env.BROWSER_PATH ||
  ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(
    (p) => fs.existsSync(p),
  );

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n") row.push(cell.replace(/\r$/, "")), rows.push(row), (row = []), (cell = "");
    else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}

const num = (v) => (v === "" || v == null ? null : Number(v));
const csv = parseCsv(fs.readFileSync("../murder_mystery_games.csv", "utf8").replace(/^\uFEFF/, "")).slice(1);
const games = {};
const ids = [];
csv
  .filter((r) => r[16])
  .slice(0, 16)
  .forEach((r, i) => {
    const id = `g${i}`;
    ids.push(id);
    games[id] = {
      name: r[0],
      publisher: r[2].split(",")[0],
      price: num(r[4]),
      releaseDate: r[5] ? `${r[5]}-01-01` : "",
      rating: r[6] ? Math.round((Number(r[6]) / 2) * 10) / 10 : null,
      minPlayers: num(r[8]),
      maxPlayers: num(r[9]),
      playTime: num(r[10]),
      difficulty: Number(r[11]) >= 2.5 ? "어려움" : Number(r[11]) >= 1.8 ? "보통" : "쉬움",
      genres: r[13].split("/").map((s) => s.trim()).filter(Boolean),
      imageUrl: r[16],
      description: "",
      createdAt: "2026-10-01T00:00:00.000Z",
    };
  });

const pick = (list) => Object.fromEntries(list.map((i) => [ids[i], true]));
const played = (list) => Object.fromEntries(list.map(([i, rating, date]) => [ids[i], { rating, date }]));
const users = {
  me: {
    googleName: "탐정",
    nickname: "명탐정 코난",
    bio: "범인은 이 안에 있다 🔍",
    photo: "",
    played: played([[0, 5, "2026-09-14"], [1, 4, "2026-09-28"], [3, 5, "2026-10-05"], [5, 3, "2026-10-12"], [7, 4, "2026-10-18"]]),
    liked: pick([2, 4, 6]),
    owned: pick([0, 1, 3]),
    prefGenres: ["추리·탐정", "머더미스터리"],
    prefLength: "2~3시간",
  },
  u1: { googleName: "민지", played: played([[0, 4, "2026-09-14"], [2, 5, "2026-10-02"]]), owned: pick([2, 4]) },
  u2: { googleName: "준호", played: played([[0, 5, "2026-09-14"], [3, 4, "2026-10-05"]]), owned: pick([5, 6, 0]) },
  u3: { googleName: "서연", played: played([[1, 5, "2026-09-28"]]), owned: pick([7, 8]) },
  u4: { googleName: "도윤", played: played([[3, 3, "2026-10-05"]]), owned: pick([9]) },
};
const guests = { x1: { name: "하늘(비회원)", owned: pick([10, 11]), createdBy: "me" } };
games[ids[2]].rentals = { u1: { uid: "me", name: "명탐정 코난", date: "2026-10-15" } };
games[ids[0]].rentals = { me: { uid: "u3", name: "서연", date: "2026-10-17" } };

const ev = (id, gi, date, time, place, parts, host = ["me", "명탐정 코난"]) => [
  id,
  {
    gameId: ids[gi], gameName: games[ids[gi]].name, date, time, place,
    minPlayers: games[ids[gi]].minPlayers || 4, maxPlayers: games[ids[gi]].maxPlayers || 6,
    hostUid: host[0], hostName: host[1], participants: parts, note: "스포일러 금지!", createdAt: "2026-10-10T00:00:00.000Z",
  },
];
const events = Object.fromEntries([
  ev("e1", 1, "2026-10-24", "19:00", "강남 보드카페", { me: "명탐정 코난", u1: "민지", u2: "준호" }),
  ev("e2", 4, "2026-10-31", "14:00", "준호네 집", { u2: "준호", u3: "서연", u4: "도윤", me: "명탐정 코난" }, ["u2", "준호"]),
  ev("e3", 6, "2026-11-07", "18:30", "홍대 머더미스터리 카페", { u1: "민지" }, ["u1", "민지"]),
]);

const seed = {
  mm_games: games,
  mm_users: users,
  mm_guests: guests,
  mm_events: events,
  mm_me: { uid: "me", name: "탐정", photo: "" },
};

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ["--lang=ko-KR"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.5 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
// 게임 이미지 서버가 다른 사이트에서 불러오는 것을 막아서, 외부 이미지는 Node에서 받아 대신 응답한다
const imgCache = new Map();
await page.setRequestInterception(true);
page.on("request", async (req) => {
  const url = req.url();
  if (req.resourceType() !== "image" || !url.startsWith("http") || url.startsWith(BASE)) return req.continue();
  try {
    if (!imgCache.has(url)) {
      const res = await fetch(url);
      imgCache.set(url, { status: res.status, contentType: res.headers.get("content-type") || "image/jpeg", body: Buffer.from(await res.arrayBuffer()) });
    }
    req.respond(imgCache.get(url));
  } catch {
    req.abort();
  }
});
await page.evaluateOnNewDocument((s) => {
  for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v));
  document.addEventListener("DOMContentLoaded", () => {
    const st = document.createElement("style");
    st.textContent = ".demo-banner{display:none!important} ::-webkit-scrollbar{display:none}";
    document.head.appendChild(st);
  });
}, seed);

async function shot(name, url, { scroll = 0, after } = {}) {
  await page.goto(BASE + url, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 800));
  if (after) await after();
  if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("saved", name);
}

await shot("games", "/games");
await shot("detail", `/games/${ids[3]}`);
await shot("schedule", "/schedule");
await shot("library", "/library");
await shot("mypage", "/mypage");
await browser.close();

// 인트로 증거판에 쓸 게임 표지
const COVERS = path.resolve("public/covers");
fs.mkdirSync(COVERS, { recursive: true });
for (const [i, id] of ids.slice(0, 6).entries()) {
  const res = await fetch(games[id].imageUrl);
  fs.writeFileSync(path.join(COVERS, `c${i}.jpg`), Buffer.from(await res.arrayBuffer()));
  console.log("saved cover", i, games[id].name);
}
