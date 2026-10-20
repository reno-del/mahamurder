// 검색엔진(SEO)·AI 답변 엔진(AEO)·생성형 검색(GEO)을 위한 빌드 플러그인.
// 이 사이트는 클라이언트에서 그리는 SPA라 JS를 실행하지 않는 크롤러(대부분의 AI 크롤러)에는 빈 화면만 보인다.
// 그래서 빌드할 때 Firestore 공개 REST API로 게임 목록을 읽어 index.html 안에 정적 HTML과 구조화 데이터로 넣고,
// sitemap.xml·robots.txt·llms.txt도 함께 만든다. 게임은 빌드(=배포) 시점 기준이므로 게임이 바뀌면 다시 배포해야 반영된다.
import type { HtmlTagDescriptor, Plugin } from "vite";
import { FAQ, SITE } from "../src/data/site";
import { gameSummary, jsonLd, LD_SCRIPT_ID, publicGames, structuredData, type SeoGame } from "../src/lib/seo";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PROJECT_ID = "mahamuder";

// ---------- Firestore REST 응답 해석 ----------

type FsValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  arrayValue?: { values?: FsValue[] };
};
type FsDoc = { fields?: Record<string, FsValue> };

const str = (v?: FsValue) => (v?.stringValue || "").trim() || undefined;
const num = (v?: FsValue) => {
  const n = v?.integerValue != null ? Number(v.integerValue) : v?.doubleValue;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
};

async function fetchGames(): Promise<SeoGame[]> {
  const docs: FsDoc[] = [];
  let pageToken = "";
  do {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/games?pageSize=300` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firestore ${res.status}`);
    const body = (await res.json()) as { documents?: FsDoc[]; nextPageToken?: string };
    docs.push(...(body.documents || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);

  return publicGames(
    // 예시 데이터는 publicGames가 뺀다. 대여 기록 같은 개인 정보는 처음부터 읽지 않는다
    docs.map(({ fields: f = {} }) => ({
      name: str(f.name) || "",
      publisher: str(f.publisher),
      minPlayers: num(f.minPlayers),
      maxPlayers: num(f.maxPlayers),
      playTime: num(f.playTime),
      genres: (f.genres?.arrayValue?.values || []).map((v) => str(v)).filter((s): s is string => !!s),
      imageUrl: str(f.imageUrl),
      description: str(f.description),
      localized: f.localized?.booleanValue !== false,
    }))
  );
}

// ---------- 정적 HTML (JS 실행 전·JS를 안 쓰는 크롤러용, React가 그리면 사라진다) ----------

function staticBody(games: SeoGame[]) {
  const gameList = games.length
    ? `<section class="card">
        <h2 class="section-title">머더미스터리 게임 목록 (${games.length})</h2>
        <ul>${games
          .map((g) => `<li><b>${esc(g.name)}</b>${gameSummary(g) ? ` — ${esc(gameSummary(g))}` : ""}</li>`)
          .join("")}</ul>
      </section>`
    : "";
  return `<div id="root"><main class="view seo-static">
      <section class="hero">
        <h1>${esc(SITE.name)}</h1>
        <p class="muted">${esc(SITE.description)}</p>
      </section>
      ${gameList}
      <section class="card">
        <h2 class="section-title">자주 묻는 질문</h2>
        ${FAQ.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}
      </section>
    </main></div>`;
}

// ---------- 빌드 산출물 ----------

function llmsTxt(games: SeoGame[]) {
  return [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    `- 사이트: ${SITE.url}`,
    "- 언어: 한국어",
    "- 게임 소개는 누구나 볼 수 있고, 플레이 기록·일정 모집·보유 게임 대여는 Google 로그인 후 이용합니다.",
    "- 게임 소개에는 스포일러를 쓰지 않습니다.",
    "",
    "## 주요 화면",
    "",
    `- [게임 소개](${SITE.url}#/games): 인원·장르·정발 여부·보유 여부로 게임 검색, 친구 평점`,
    `- [일정 모집](${SITE.url}#/schedule): 달력으로 모임 일정을 만들고 참가`,
    `- [보유 게임](${SITE.url}#/library): 친구별 보유 게임과 대여 현황`,
    `- [마이페이지](${SITE.url}#/mypage): 플레이 기록, 선호 장르, 추천 게임`,
    "",
    "## 자주 묻는 질문",
    "",
    ...FAQ.flatMap((f) => [`### ${f.q}`, "", f.a, ""]),
    ...(games.length
      ? [`## 머더미스터리 게임 목록 (${games.length})`, "", ...games.map((g) => `- ${g.name}${gameSummary(g) ? `: ${gameSummary(g)}` : ""}`), ""]
      : []),
  ].join("\n");
}

// 빌드한 PC의 현지 날짜 (toISOString은 UTC라 한국 시간 오전에는 하루 전 날짜가 된다)
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE.url}</loc>
    <lastmod>${today()}</lastmod>
    <changefreq>weekly</changefreq>
  </url>
</urlset>
`;

const robotsTxt = () => `# 모든 검색엔진과 AI 크롤러의 수집을 허용합니다
User-agent: *
Allow: /

Sitemap: ${SITE.url}sitemap.xml
`;

// ---------- 플러그인 ----------

export function seoPlugin(): Plugin {
  let isBuild = false;
  let games: SeoGame[] = [];

  return {
    name: "mahamuder-seo",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    async buildStart() {
      if (!isBuild) return;
      try {
        games = await fetchGames();
        this.info(`게임 ${games.length}개를 정적 HTML·구조화 데이터에 넣었어요`);
      } catch (err) {
        // 네트워크가 없어도 빌드는 되도록, 게임 목록만 빼고 진행한다
        this.warn(`게임 목록을 읽지 못해 정적 게임 목록 없이 빌드합니다: ${String(err)}`);
        games = [];
      }
    },
    transformIndexHtml(html) {
      const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: "meta", attrs, injectTo: "head" });
      const tags: HtmlTagDescriptor[] = [
        meta({ name: "keywords", content: SITE.keywords.join(", ") }),
        meta({ name: "robots", content: "index, follow, max-image-preview:large" }),
        meta({ name: "theme-color", content: "#9b1c2c" }),
        { tag: "link", attrs: { rel: "canonical", href: SITE.url }, injectTo: "head" },
        meta({ property: "og:type", content: "website" }),
        meta({ property: "og:site_name", content: SITE.name }),
        meta({ property: "og:locale", content: "ko_KR" }),
        meta({ property: "og:url", content: SITE.url }),
        meta({ property: "og:title", content: SITE.title }),
        meta({ property: "og:description", content: SITE.description }),
        meta({ property: "og:image", content: SITE.ogImage }),
        meta({ property: "og:image:width", content: "1200" }),
        meta({ property: "og:image:height", content: "630" }),
        meta({ property: "og:image:alt", content: `${SITE.name} — 머더미스터리 게임 추천·후기·모임 일정` }),
        meta({ name: "twitter:card", content: "summary_large_image" }),
        meta({ name: "twitter:title", content: SITE.title }),
        meta({ name: "twitter:description", content: SITE.description }),
        meta({ name: "twitter:image", content: SITE.ogImage }),
        { tag: "link", attrs: { rel: "alternate", type: "text/plain", href: "/llms.txt", title: "LLM용 사이트 요약" }, injectTo: "head" },
        { tag: "script", attrs: { type: "application/ld+json", id: LD_SCRIPT_ID }, children: jsonLd(structuredData(games)), injectTo: "head" },
      ];
      return {
        html: html
          .replace(/<title>[^<]*<\/title>/, `<title>${esc(SITE.title)}</title>`)
          .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(SITE.description)}" />`)
          .replace('<div id="root"></div>', staticBody(games)),
        tags,
      };
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "llms.txt", source: llmsTxt(games) });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemapXml() });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robotsTxt() });
    },
  };
}
