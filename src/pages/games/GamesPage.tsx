import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "../../store";
import { requireLogin, useApp, useGameHelpers } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { Cover } from "../../components/Cover";
import { showError } from "../../lib/toast";
import { cleanName, playTime, players, prettyDate, stars, won, ymd } from "../../lib/format";
import { GameDetail } from "./GameDetail";
import { GameForm } from "./GameForm";
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
        <h3 className="game-title">{g.name}</h3>
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
            <dd>{players(g)}</dd>
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
  const { openModal } = useModal();
  const [filter, setFilter] = useState<Filter>(savedFilter);
  useEffect(() => {
    savedFilter = filter;
  }, [filter]);
  const set = <K extends keyof Filter>(key: K, value: Filter[K]) => setFilter((f) => ({ ...f, [key]: value }));

  const q = filter.q.trim().toLowerCase();
  const size = Number(filter.size);
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
        (!size || ((g.minPlayers || 0) <= size && size <= (g.maxPlayers || g.minPlayers || 99))) &&
        (!filter.owned || ownersOf(g.id).length > 0 === (filter.owned === "yes")) &&
        (!filter.localized || (g.localized !== false) === (filter.localized === "yes"))
    )
    .sort(sorters[filter.sort]);

  const openDetail = (id: string) => openModal(<GameDetail gameId={id} />);

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
    </>
  );
}
