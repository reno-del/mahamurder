// schema.org 구조화 데이터(JSON-LD). 빌드 때(seo/plugin.ts)와 실행 중(useLiveStructuredData) 같은 함수를 쓴다.
// 브라우저와 Node 양쪽에서 돌아가야 하므로 React나 DOM을 import하지 않는다.
import { FAQ, SITE } from "../data/site";
import type { Game } from "../types";

/** 구조화 데이터에 넣는 공개 게임 정보 (대여 기록 같은 개인 정보는 넣지 않는다) */
export interface SeoGame {
  name: string;
  publisher?: string;
  minPlayers?: number;
  maxPlayers?: number;
  playTime?: number;
  genres: string[];
  imageUrl?: string;
  description?: string;
  localized: boolean;
}

const isExample = (name: string) => name.startsWith("예시)");
const byName = (a: SeoGame, b: SeoGame) => a.name.localeCompare(b.name, "ko");

/** 예시 데이터를 빼고 이름순으로 정리 */
export const publicGames = (games: SeoGame[]) => games.filter((g) => g.name && !isExample(g.name)).sort(byName);

export const toSeoGame = (g: Game): SeoGame => ({
  name: (g.name || "").trim(),
  publisher: g.publisher || undefined,
  minPlayers: g.minPlayers || undefined,
  maxPlayers: g.maxPlayers || undefined,
  playTime: g.playTime || undefined,
  genres: g.genres || [],
  imageUrl: g.imageUrl || undefined,
  description: g.description || undefined,
  localized: g.localized !== false,
});

const playersText = (g: SeoGame) =>
  !g.minPlayers ? "" : !g.maxPlayers || g.maxPlayers === g.minPlayers ? `${g.minPlayers}인` : `${g.minPlayers}~${g.maxPlayers}인`;
const timeText = (m?: number) => (!m ? "" : m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`);

/** "4~6인 · 3시간 · 추리 · 출판사" 같은 한 줄 요약 */
export const gameSummary = (g: SeoGame) =>
  [playersText(g), timeText(g.playTime), g.genres.join(", "), g.publisher, g.localized ? "" : "미정발"].filter(Boolean).join(" · ");

export function structuredData(games: SeoGame[]) {
  const graph: unknown[] = [
    {
      "@type": "WebSite",
      "@id": `${SITE.url}#website`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      inLanguage: "ko-KR",
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE.url}#faq`,
      inLanguage: "ko-KR",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
  if (games.length)
    graph.push({
      "@type": "ItemList",
      "@id": `${SITE.url}#games`,
      name: `${SITE.name} 머더미스터리 게임 목록`,
      numberOfItems: games.length,
      itemListElement: games.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "BoardGame",
          name: g.name,
          ...(g.description && { description: g.description }),
          ...(g.imageUrl && { image: g.imageUrl }),
          ...(g.publisher && { publisher: { "@type": "Organization", name: g.publisher } }),
          ...(g.minPlayers && {
            numberOfPlayers: { "@type": "QuantitativeValue", minValue: g.minPlayers, maxValue: g.maxPlayers || g.minPlayers },
          }),
          ...(g.playTime && { timeRequired: `PT${g.playTime}M` }),
          ...(g.genres.length && { genre: g.genres }),
        },
      })),
    });
  return { "@context": "https://schema.org", "@graph": graph };
}

/** <script type="application/ld+json"> 안에 넣을 문자열. "</script>"가 새지 않도록 <를 이스케이프한다 */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** index.html에 들어 있는 구조화 데이터 script의 id */
export const LD_SCRIPT_ID = "ld-site";
