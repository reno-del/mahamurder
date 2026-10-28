import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { store } from "../../store";
import { requireLogin, useApp, useGameHelpers } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { Cover } from "../../components/Cover";
import { showError } from "../../lib/toast";
import { cleanName, playTime, players, prettyDate, stars, won, ymd } from "../../lib/format";
import { GameDetail } from "./GameDetail";
import { GameForm } from "./GameForm";
import { CsvImport } from "./CsvImport";
import { usePageMeta } from "../../lib/usePageMeta";
import { gameDescription, toSeoGame } from "../../lib/seo";
import { FAQ } from "../../data/site";
import type { Game } from "../../types";

type SortKey = "rating" | "release" | "priceAsc" | "popular" | "name";
interface Filter {
  q: string;
  genre: string;
  size: string;
  owned: "" | "yes" | "no";
  localized: "" | "yes" | "no";
  sort: SortKey;
}

// 다른 페이지에 다녀와도 검색 조건이 유지되도록 모듈에 보관
let savedFilter: Filter = { q: "", genre: "", size: "", owned: "", localized: "", sort: "rating" };

function UpcomingStrip() {
  const { user, events } = useApp();
  if (!user) return null;
  const today = ymd();
  const list = events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
    .slice(0, 3);
  if (!list.length) return null;
  return (
    <section className="notice-strip">
      <h2 className="strip-title">📢 모집 중인 일정</h2>
      <div className="strip-list">
        {list.map((e) => (
          <Link key={e.id} className="strip-item" to="/schedule">
            <b>
              {prettyDate(e.date)} {e.time || ""}
            </b>
            <span>{e.gameName}</span>
            <span className="muted small">
              {Object.keys(e.participants || {}).length}/{e.maxPlayers || "?"}명
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function GameCard({ game: g, onOpen }: { game: Game; onOpen: () => void }) {
  const { me } = useApp();
  const { friendRating, playedBy, copiesOf } = useGameHelpers();
  const fr = friendRating(g.id);
  const n = playedBy(g.id).length;
  const copies = copiesOf(g);
  const free = copies.filter((c) => !c.rental).length;
  return (
    <article className="card game-card" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <Cover game={g} />
      <div className="game-body">
        <div className="badges">
          {g.localized === false && <span className="badge badge-unofficial">미정발</span>}
          {me?.owned?.[g.id] ? (
            <span className="badge badge-owned">📦 내 게임</span>
          ) : (
            copies.length > 0 &&
            (free ? <span className="badge badge-owned">구비 {copies.length}</span> : <span className="badge badge-rented">모두 대여 중</span>)
          )}
          {me?.played?.[g.id] && <span className="badge badge-done">플레이함</span>}
          {me?.liked?.[g.id] && <span className="badge badge-like">♥ 선호</span>}
        </div>
        <h3 className="game-title">
          {/* 크롤러가 게임 페이지를 따라갈 수 있도록 실제 링크로 둔다. 카드 클릭과 겹치지 않게 전파를 막는다 */}
          <Link to={`/games/${g.id}`} onClick={(e) => e.stopPropagation()}>
            {g.name}
          </Link>
        </h3>
        <p className="muted small">{g.publisher || ""}</p>
        <div className="rating">
          <span className="stars">{stars(g.rating)}</span> <b>{g.rating ? Number(g.rating).toFixed(1) : "-"}</b>{" "}
          {fr && <span className="muted small">· 친구 평균 {fr.avg.toFixed(1)}</span>}
        </div>
        <dl className="facts">
          <div>
            <dt>가격</dt>
            <dd>{won(g.price)}</dd>
          </div>
          <div>
            <dt>출시</dt>
            <dd>{g.releaseDate || "-"}</dd>
          </div>
          <div>
            <dt>인원</dt>
            <dd>{g.minPlayers ? players(g) : <span className="badge badge-unofficial">인원 미정</span>}</dd>
          </div>
          <div>
            <dt>시간</dt>
            <dd>{playTime(g.playTime) || "-"}</dd>
          </div>
        </dl>
        <div className="tags">
          {(g.genres || []).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        {n > 0 && <p className="muted small">👥 친구 {n}명 플레이</p>}
      </div>
    </article>
  );
}

export function GamesPage() {
  const { user, games } = useApp();
  const { allGenres, playedBy, ownersOf } = useGameHelpers();
  const { openModal, closeModal } = useModal();
  const [filter, setFilter] = useState<Filter>(savedFilter);
  useEffect(() => {
    savedFilter = filter;
  }, [filter]);
  const set = <K extends keyof Filter>(key: K, value: Filter[K]) => setFilter((f) => ({ ...f, [key]: value }));

  // /games/<id> 주소면 목록 위에 그 게임의 상세 모달을 띄운다. 모달을 닫으면 /games로 돌아간다
  const { gameId } = useParams();
  const navigate = useNavigate();
  const current = gameId ? games.find((g) => g.id === gameId) : undefined;
  const seoGame = current && toSeoGame(current);
  usePageMeta(seoGame ? cleanName(seoGame.name) : undefined, seoGame ? gameDescription(seoGame) : undefined, current ? `games/${current.id}` : "");

  const openedByRoute = useRef(false);
  const hasCurrent = !!current;
  const loaded = games.length > 0;
  useEffect(() => {
    if (!gameId) {
      // 뒤로 가기 등으로 주소에서 게임이 빠지면 띄워 둔 모달도 닫는다
      if (openedByRoute.current) closeModal();
      openedByRoute.current = false;
      return;
    }
    if (!hasCurrent) {
      // 목록을 받았는데도 없으면 지워진 게임이므로 목록으로 보낸다 (아직 받기 전이면 기다린다)
      if (loaded) navigate("/games", { replace: true });
      return;
    }
    openedByRoute.current = true;
    openModal(<GameDetail gameId={gameId} />, {
      onClose: () => {
        openedByRoute.current = false;
        // 모달 안에서 다른 페이지로 이동하며 닫힌 경우(모집하기 등)는 그대로 둔다
        if (window.location.pathname === `/games/${gameId}`) navigate("/games");
      },
    });
    // games 자체는 의존성에서 뺀다 (게임 정보가 바뀔 때마다 모달을 다시 열지 않도록). 받았는지·찾았는지만 본다
  }, [gameId, hasCurrent, loaded]);

  const q = filter.q.trim().toLowerCase();
  // 인원을 고르면 인원 미정 게임은 뺀다. "none"은 미정 게임만, "10+"는 10명 이상 할 수 있는 게임
  const fitsSize = (g: Game) => {
    if (!filter.size) return true;
    if (filter.size === "none") return !g.minPlayers;
    if (!g.minPlayers) return false;
    const max = g.maxPlayers || g.minPlayers;
    if (filter.size === "10+") return max >= 10;
    const size = Number(filter.size);
    return g.minPlayers <= size && size <= max;
  };
  const sorters: Record<SortKey, (a: Game, b: Game) => number> = {
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    release: (a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")),
    priceAsc: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
    name: (a, b) => cleanName(a.name).localeCompare(cleanName(b.name), "ko"),
    popular: (a, b) => playedBy(b.id).length - playedBy(a.id).length,
  };
  const list = games
    .filter(
      (g) =>
        (!q || [g.name, g.publisher, g.description, ...(g.genres || [])].join(" ").toLowerCase().includes(q)) &&
        (!filter.genre || (g.genres || []).includes(filter.genre)) &&
        fitsSize(g) &&
        (!filter.owned || ownersOf(g.id).length > 0 === (filter.owned === "yes")) &&
        (!filter.localized || (g.localized !== false) === (filter.localized === "yes"))
    )
    .sort(sorters[filter.sort]);

  const openDetail = (id: string) => navigate(`/games/${id}`);

  return (
    <>
      <section className="hero">
        <h1>오늘 밤, 누가 범인일까?</h1>
        <p className="muted">우리끼리 해 본 / 하고 싶은 머더미스터리 게임 모음</p>
      </section>
      <UpcomingStrip />
      <div className="toolbar">
        <input
          id="f-q"
          className="input"
          type="search"
          placeholder="게임 이름, 장르, 제작사 검색"
          value={filter.q}
          onChange={(e) => set("q", e.target.value)}
        />
        <select className="input" value={filter.genre} onChange={(e) => set("genre", e.target.value)}>
          <option value="">장르 전체</option>
          {allGenres().map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select className="input" value={filter.size} onChange={(e) => set("size", e.target.value)}>
          <option value="">인원 전체</option>
          {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n}명이서
            </option>
          ))}
          <option value="10+">10명 이상</option>
          <option value="none">인원 미정</option>
        </select>
        <select className="input" value={filter.owned} onChange={(e) => set("owned", e.target.value as Filter["owned"])}>
          <option value="">구비 전체</option>
          <option value="yes">구비 중</option>
          <option value="no">구비 안 됨</option>
        </select>
        <select className="input" value={filter.localized} onChange={(e) => set("localized", e.target.value as Filter["localized"])}>
          <option value="">정발 전체</option>
          <option value="yes">정발됨</option>
          <option value="no">미정발</option>
        </select>
        <select className="input" value={filter.sort}onChange={(e) => set("sort", e.target.value as SortKey)}>
          <option value="rating">평점순</option>
          <option value="release">최신 출시순</option>
          <option value="priceAsc">낮은 가격순</option>
          <option value="popular">친구 플레이순</option>
          <option value="name">이름순</option>
        </select>
        <button className="btn btn-primary" onClick={() => requireLogin(user) && openModal(<GameForm />)}>
          + 게임 추가
        </button>
        <button className="btn" onClick={() => requireLogin(user) && openModal(<CsvImport />)}>
          CSV 가져오기
        </button>
      </div>
      <div className="grid">
        {!games.length ? (
          <div className="empty">
            아직 등록된 게임이 없어요.
            <br />
            <button className="btn" onClick={() => requireLogin(user) && store.seedGames().catch(showError)}>
              예시 게임 불러오기
            </button>
          </div>
        ) : !list.length ? (
          <div className="empty">조건에 맞는 게임이 없어요.</div>
        ) : (
          list.map((g) => <GameCard key={g.id} game={g} onOpen={() => openDetail(g.id)} />)
        )}
      </div>
      {/* 구조화 데이터(FAQPage)와 같은 내용을 화면에도 보여 준다 */}
      <section className="card faq" aria-labelledby="faq-title">
        <h2 id="faq-title" className="section-title">
          자주 묻는 질문
        </h2>
        {FAQ.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
