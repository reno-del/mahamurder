// 게임 분류. 배경 태그(이세계·판타지 등)는 스포일러가 될 수 있어서 화면에는 이 세 가지만 보여 준다.
// 빌드(seo/plugin.ts)에서도 쓰므로 React나 DOM을 import하지 않는다.
import type { Category } from "../types";

export const CATEGORIES: { id: Category; name: string; hint: string; intro: string }[] = [
  { id: "murder", name: "머더미스터리", hint: "역할극", intro: "각자 맡은 인물을 연기하며 범인을 찾아요." },
  { id: "deduction", name: "추리", hint: "협력 추리", intro: "모두 함께 단서를 모아 사건을 풀어요." },
  { id: "social", name: "소셜 디덕션", hint: "마피아류", intro: "숨은 정체를 두고 서로 속이고 밝혀내요." },
];

const isCategory = (s: unknown): s is Category => CATEGORIES.some((c) => c.id === s);

/** 장르 태그로 분류를 정한다 (분류 칸이 생기기 전 게임과 CSV용). 위에서부터 먼저 맞는 것 */
export function categoryFromGenres(genres: string[] = []): Category | undefined {
  if (genres.includes("소셜 디덕션")) return "social";
  if (genres.includes("머더미스터리")) return "murder";
  if (genres.some((g) => ["추리", "추리·탐정", "미스터리·추리"].includes(g))) return "deduction";
  return undefined;
}

/** 저장된 분류, 없으면 장르 태그에서 정한 분류. 둘 다 없으면 undefined(분류 없음) */
export const categoryOf = (g: { category?: string | null; genres?: string[] }): Category | undefined =>
  isCategory(g.category) ? g.category : categoryFromGenres(g.genres);

export const categoryName = (c?: Category) => CATEGORIES.find((x) => x.id === c)?.name || "";
