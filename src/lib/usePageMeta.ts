import { useEffect } from "react";
import { SITE } from "../data/site";
import { useApp } from "../state/AppContext";
import { jsonLd, LD_SCRIPT_ID, publicGames, structuredData, toSeoGame } from "./seo";

/** 페이지마다 탭 제목과 meta description을 바꾼다. title을 비우면 사이트 기본값 */
export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE.name}` : SITE.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description || SITE.description);
  }, [title, description]);
}

/**
 * 빌드 때 index.html에 넣은 구조화 데이터를 지금 Firestore에 있는 게임 목록으로 갱신한다.
 * (JS를 실행하는 Google 크롤러는 배포 뒤에 추가된 게임도 보게 된다)
 * 예시 데이터만 있을 때(데모 모드 등)는 빌드 때 넣은 내용을 그대로 둔다.
 */
export function useLiveStructuredData() {
  const { games } = useApp();
  useEffect(() => {
    const list = publicGames(games.map(toSeoGame));
    const el = document.getElementById(LD_SCRIPT_ID);
    if (!list.length || !el) return;
    el.textContent = jsonLd(structuredData(list));
  }, [games]);
}
