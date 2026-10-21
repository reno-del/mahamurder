// 사이트별 목록·상세 읽기. 각 함수는 사이트 구조가 바뀌면 여기서만 고치면 된다.
import { get, pool } from "./lib.mjs";

const strip = (h) =>
  (h || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
// CSV는 소수 첫째 자리까지 적는다(2 → "2.0", 1.58 → "1.58").
const dec = (v) => (v === "" || v == null || !(Number(v) > 0) ? "" : Number.isInteger(Number(v)) ? Number(v).toFixed(1) : String(Number(v)));
const pick = (s, re) => (s.match(re) || [])[1]?.trim() ?? "";

// ───────── 보드라이프 ─────────
export const BOARDLIFE_KEYWORDS = [
  "머더 미스터리", "머더미스터리", "미스터리", "살인", "살인사건", "추리", "탐정", "사건", "크라임", "범인",
  "murder", "mystery", "detective", "crime",
];

export async function boardlifeSearch(keyword) {
  const html = await get(`https://boardlife.co.kr/search.php?query=${encodeURIComponent(keyword)}&page=game`);
  return [...html.matchAll(/class='search-game-card' href='\/game\/(\d+)'[\s\S]*?class='search-game-title'>([^<]*)</g)]
    .map((m) => ({ id: m[1], title: strip(m[2]) }));
}

export async function boardlifeDetail(id) {
  const h = await get(`https://boardlife.co.kr/game/${id}`);
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return {}; } })
    .find((j) => j["@type"] === "Product") || {};
  const info = (label) => strip(pick(h, new RegExp(`game-info-label'>${label}</dt>\\s*<dd class='game-info-value'>([^<]*)<`)));
  const credit = (label) => {
    const dd = pick(h, new RegExp(`<dt>${label}</dt><dd>([\\s\\S]*?)</dd>`));
    return [...dd.matchAll(/>([^<]+)<\/a>/g)].map((m) => strip(m[1])).join(", ") || "-";
  };
  const players = info("인원").match(/(\d+)(?:\s*-\s*(\d+))?/);
  const time = info("시간").match(/(\d+)(?:\s*-\s*(\d+))?/);
  const weight = pick(h, /data-bggweight='([^']*)'/);
  const lang = pick(h, /data-bgglang='([^']*)'/);
  const bgg = pick(h, /href='(https:\/\/boardgamegeek\.com\/[^']+)'/);
  const age = info("연령");
  return {
    id,
    "게임명(한글)": strip(pick(h, /class='game-title-kr'>([^<]*)</)),
    "게임명(영문)": strip(pick(h, /class='game-title-en'>([^<]*)</)),
    "출판사": credit("퍼블리셔"),
    "디자이너": credit("디자이너"),
    "출시연도": pick(h, /class='game-title-year'>(\d{4})년/),
    "평점(10점)": dec(ld.aggregateRating?.ratingValue),
    "평가수": ld.aggregateRating?.reviewCount != null ? String(ld.aggregateRating.reviewCount) : "",
    "최소인원": players?.[1] ?? "",
    "최대인원": players?.[2] ?? players?.[1] ?? "",
    "플레이시간(분)": time?.[1] ?? "",
    "난이도(1~5)": dec(weight),
    "연령": age || "-",
    "언어의존도": lang && lang !== "-" ? lang : "",
    "확장여부": /boardgameexpansion\//.test(bgg) ? "확장" : "본판",
    "이미지URL": typeof ld.image === "string" ? ld.image : "",
    "보드라이프": `https://boardlife.co.kr/game/${id}`,
    // 장르를 고를 때 참고할 값(CSV에는 그대로 넣지 않음)
    _category: strip(pick(h, /data-vtype='category'[^>]*>[\s\S]*?class='gvs-value'>([^<]*)</)),
    _shortTitle: strip(pick(h, /class='game-short-title'>([^<]*)</)).replace(/^게임 소개글을 제안해주세요\.$/, ""),
    _bgg: bgg,
  };
}

// ───────── 텀블벅 ─────────
export const TUMBLBUG_KEYWORDS = ["머더미스터리", "머더 미스터리", "머미"];

export async function tumblbugSearch(keyword) {
  const out = [];
  for (let page = 1; page <= 60; page++) {
    const j = await get(`https://tumblbug.com/api/v2/projects?projectSort=endedAt&query=${encodeURIComponent(keyword)}&page=${page}`, { json: true });
    const r = j.body?.result;
    for (const p of r?.contents ?? []) {
      out.push({
        uuid: p.id, permalink: p.permalink, title: p.title, state: p.state, category: p.category,
        creator: p.creatorName, cover: p.coverImageUrl, start: p.fundingStartDate, end: p.endDate,
        short: p.shortDescription, pledged: p.pledgedCount,
      });
    }
    if (!r?.hasNext) break;
  }
  return out;
}

// 선물(리워드) 가격과 소개글 일부. 가격은 Claude가 '기본 패키지'를 골라 쓴다.
// uuid는 검색 API에만 있다. v1 API로 제목을 알아낸 뒤 그 제목으로 검색해 permalink가 같은 것을 찾는다.
export async function tumblbugDetail(permalink) {
  const v1 = await get(`https://tumblbug.com/api/v1/projects/${permalink}`, { json: true }).catch(() => null);
  const list = v1?.title
    ? (await get(`https://tumblbug.com/api/v2/projects?query=${encodeURIComponent(v1.title)}`, { json: true }).catch(() => null))
      ?.body?.result?.contents?.find((p) => p.permalink === permalink)
    : null;
  const uuid = list?.id;
  const rewards = uuid ? (await get(`https://tumblbug.com/api/v3/project/${uuid}/rewards?type=REGULAR`, { json: true }).catch(() => null))?.body?.result ?? [] : [];
  const story = uuid ? await get(`https://tumblbug.com/api/v2/project/${uuid}/story`).catch(() => "") : "";
  return {
    permalink,
    url: `https://tumblbug.com/${permalink}`,
    title: list?.title, state: list?.state, creator: list?.creatorName, cover: list?.coverImageUrl,
    start: list?.fundingStartDate, end: list?.endDate, short: list?.shortDescription,
    rewards: rewards.map((r) => ({ title: r.title, money: r.money, backers: r.backersCount, items: (r.items || []).map((i) => i.title).join(" / ") })),
    story: strip(story.replace(/\\n/g, " ").replace(/\\"/g, '"')).slice(0, 2500),
  };
}

// ───────── 머미나우 (murmynow.com, 고도몰) ─────────
// 001003 = 머더미스터리 > 보드게임. 001001 개인 운영·001002 플랫폼(온라인)·001004 테마공연은 실물 게임이 아니라서 제외.
export async function murmynowList(cate = "001003") {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const h = await get(`https://murmynow.com/goods/goods_list.php?cateCd=${cate}&page=${page}`);
    const items = [...h.matchAll(/goods_view\.php\?goodsNo=(\d+)[\s\S]*?<strong class="item_name">([^<]*)</g)]
      .map((m) => ({ goodsNo: m[1], name: strip(m[2]) }));
    const fresh = items.filter((i) => !out.some((o) => o.goodsNo === i.goodsNo));
    if (!fresh.length) break;
    out.push(...fresh);
  }
  return out;
}

export async function murmynowDetail(goodsNo) {
  const h = await get(`https://murmynow.com/goods/goods_view.php?goodsNo=${goodsNo}`);
  const t = strip(h);
  // 상단 정보는 <span>라벨</span><p>값</p>, 그 아래는 <dt>라벨</dt><dd>값</dd>. 라벨 순서는 상품마다 다르다.
  const f = {};
  for (const m of h.matchAll(/<span>([^<]{1,10})<\/span>\s*<p>([\s\S]*?)<\/p>|<dt>([^<]{1,10})<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)) {
    const k = strip(m[1] || m[3]), v = strip(m[2] || m[4]);
    if (!(k in f)) f[k] = /^(미입력|미정|-)$/.test(v) ? "" : v;
  }
  const price = pick(t, /판매가 ([\d,]+) 원/).replace(/,/g, "");
  return {
    goodsNo,
    url: `https://murmynow.com/goods/goods_view.php?goodsNo=${goodsNo}`,
    name: strip(pick(h, /og:title" content="([^"]*)"/)),
    players: f["인원"] ?? "",
    time: f["소요시간"] ?? "",
    author: f["작가"] ?? "",
    publisher: f["퍼블리셔"] ?? "",
    mode: f["진행방식"] ?? "",
    // 상품마다 붙은 "오프라인"/"온라인" 표시. 온라인은 실물 게임이 아니라서 draft.mjs가 뺀다.
    format: pick(h, /class="icon_onoffline">([^<]*)</),
    released: pick(t, /출시일 (\d{4}-\d{2}-\d{2})/),
    price: price && price !== "0" ? price : "",
    image: pick(h, /og:image" content="([^"]*)"/),
    short: (f["짧은설명"] || f["테마 소개"] || "").slice(0, 400),
    links: [...new Set(h.match(/https?:\/\/(?:www\.)?tumblbug\.com\/[\w-]+/g) || [])],
  };
}

export const details = { boardlife: boardlifeDetail, tumblbug: tumblbugDetail, murmynow: murmynowDetail };
export { pool };
