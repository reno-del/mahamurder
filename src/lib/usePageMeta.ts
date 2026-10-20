import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SITE } from "../data/site";
import { useApp } from "../state/AppContext";
import { gameStructuredData, jsonLd, LD_SCRIPT_ID, publicGames, structuredData, toSeoGame } from "./seo";

function setMeta(selector: string, attr: string, value: string) {
  document.querySelector(selector)?.setAttribute(attr, value);
}

/**
 * 페이지마다 탭 제목·meta description·canonical·공유(og) 정보를 바꾼다. title을 비우면 사이트 기본값.
 * path는 canonical에 쓸 경로("games/<id>" 등)로, 비우면 사이트 첫 화면을 가리킨다.
 */
export function usePageMeta(title?: string, description?: string, path = "") {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE.name}` : SITE.title;
    const desc = description || SITE.description;
    const url = SITE.url + path;
    document.title = fullTitle;
    setMeta('meta[name="description"]', "content", desc);
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[property="og:title"]', "content", fullTitle);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:url"]', "content", url);
  }, [title, description, path]);
}

/**
 * 빌드 때 HTML에 넣은 구조화 데이터를 지금 Firestore에 있는 게임으로 갱신한다.
 * (JS를 실행하는 Google 크롤러는 배포 뒤에 추가·수정된 게임도 보게 된다)
 * 게임 상세 주소(/games/<id>)에서는 그 게임 하나의 정보를, 그 밖에서는 사이트 전체 정보를 넣는다.
 * 예시 데이터만 있을 때(데모 모드 등)는 빌드 때 넣은 내용을 그대로 둔다.
 */
export function useLiveStructuredData() {
  const { games } = useApp();
  const { pathname } = useLocation();
  useEffect(() => {
    const el = document.getElementById(LD_SCRIPT_ID);
    const list = publicGames(games.map(toSeoGame));
    if (!el || !list.length) return;
    const gameId = decodeURIComponent(pathname.match(/^\/games\/([^/]+)/)?.[1] || "");
    const game = gameId && list.find((g) => g.id === gameId);
    el.textContent = jsonLd(game ? gameStructuredData(gameId, game) : structuredData(list));
  }, [games, pathname]);
}
