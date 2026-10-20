import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { store } from "../../store";
import { useApp, useGameHelpers } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { LoginRequired } from "../../components/Layout";
import { Cover } from "../../components/Cover";
import { showError, toast } from "../../lib/toast";
import { cleanName, displayName, players, prettyDate, ymd } from "../../lib/format";
import { GameDetail } from "../games/GameDetail";
import type { Game, Profile } from "../../types";

const LENGTHS = ["~2시간", "2~4시간", "4시간 이상", "상관없음"];
type Tab = "all" | "played" | "todo" | "liked" | "owned";
const TABS: [Tab, string][] = [
  ["all", "전체"],
  ["played", "플레이함"],
  ["todo", "안 해봄"],
  ["liked", "선호"],
  ["owned", "보유"],
];
let savedTab: Tab = "all";

// 게임 기록 목록 접힘 여부. 새로고침해도 유지되도록 localStorage에 저장한다
const COLLAPSE_KEY = "mm_checklist_collapsed";
function loadCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}
function saveCollapsed(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    // 저장할 수 없으면 이번 방문 동안만 유지
  }
}

function ProfileForm({ me }: { me: Profile }) {
  const { user } = useApp();
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      await store.setProfileField(me.id, "nickname", f.nickname.trim());
      await store.setProfileField(me.id, "bio", f.bio.trim());
      toast("프로필을 저장했어요");
    } catch (err) {
      showError(err);
    }
  };
  return (
    <form className="profile-form" onSubmit={onSubmit}>
      <label>
        닉네임
        <input className="input" name="nickname" maxLength={20} defaultValue={me.nickname || user?.name || ""} />
      </label>
      <label>
        한마디
        <input className="input" name="bio" maxLength={60} placeholder="예) 범인 역할 전문입니다" defaultValue={me.bio || ""} />
      </label>
      <button className="btn btn-sm">저장</button>
    </form>
  );
}

// 안 해 본 게임 중 선호 장르·선호 표시가 많이 겹치는 순서로 추천
function Recommend({ me, onOpen }: { me: Profile; onOpen: (id: string) => void }) {
  const { games } = useApp();
  const pref = me.prefGenres || [];
  const list = games
    .filter((g) => !me.played?.[g.id])
    .map((g) => ({
      g,
      score: (g.genres || []).filter((x) => pref.includes(x)).length * 2 + (me.liked?.[g.id] ? 3 : 0) + (g.rating || 0) / 5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!list.length) return null;
  return (
    <section>
      <h2 className="section-title">🔎 아직 안 해 본 추천 게임</h2>
      <div className="reco">
        {list.map(({ g }) => (
          <div key={g.id} className="reco-item" onClick={() => onOpen(g.id)}>
            <Cover game={g} className="cover-sm" />
            <div>
              <b>{cleanName(g.name)}</b>
              <br />
              <span className="muted small">
                {players(g)} · {(g.genres || []).join(", ")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Checklist({ me, tab, onOpen }: { me: Profile; tab: Tab; onOpen: (id: string) => void }) {
  const { games } = useApp();
  const { togglePlayed, toggleLiked, setRating, toggleOwned } = useGameHelpers();
  const keep: Record<Tab, (g: Game) => boolean> = {
    all: () => true,
    played: (g) => !!me.played?.[g.id],
    todo: (g) => !me.played?.[g.id],
    liked: (g) => !!me.liked?.[g.id],
    owned: (g) => !!me.owned?.[g.id],
  };
  const list = games.filter(keep[tab]).sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), "ko"));
  if (!list.length) return <p className="muted small">해당하는 게임이 없어요.</p>;
  return (
    <ul className="checklist">
      {list.map((g) => {
        const p = me.played?.[g.id];
        const liked = me.liked?.[g.id];
        const owned = me.owned?.[g.id];
        return (
          <li key={g.id}>
            <button className={`check ${p ? "on" : ""}`} aria-label="플레이 여부" onClick={() => togglePlayed(g.id)}>
              {p ? "✔" : ""}
            </button>
            <button className="link-btn" onClick={() => onOpen(g.id)}>
              {g.name}
            </button>
            <span className="rate">
              {p ? (
                [1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`star-btn sm ${p.rating >= n ? "on" : ""}`}
                    aria-label={`${n}점`}
                    onClick={() => setRating(g.id, n)}
                  >
                    ★
                  </button>
                ))
              ) : (
                <span className="muted small">안 해봄</span>
              )}
            </span>
            <button
              className={`own-btn ${owned ? "on" : ""}`}
              aria-label="보유"
              aria-pressed={!!owned}
              title={owned ? "보유 중" : "가지고 있어요"}
              onClick={() => toggleOwned(g)}
            >
              📦
            </button>
            <button className={`heart ${liked ? "on" : ""}`} aria-label="선호" onClick={() => toggleLiked(g.id)}>
              {liked ? "♥" : "♡"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Friends() {
  const { user, profiles, games } = useApp();
  const others = profiles.filter((p) => p.id !== user?.uid);
  if (!others.length) return <p className="muted small">아직 다른 친구가 없어요. 사이트 주소를 공유해 보세요!</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>이름</th>
            <th>플레이</th>
            <th>보유</th>
            <th>선호 장르</th>
            <th>한마디</th>
          </tr>
        </thead>
        <tbody>
          {others.map((p) => (
            <tr key={p.id}>
              <td>{displayName(p) || "익명"}</td>
              <td>{Object.keys(p.played || {}).filter((id) => games.some((g) => g.id === id)).length}개</td>
              <td>{Object.keys(p.owned || {}).filter((id) => games.some((g) => g.id === id)).length}개</td>
              <td>{(p.prefGenres || []).join(", ") || "-"}</td>
              <td className="muted">{p.bio || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MyPage() {
  const { user, me, games, profiles, events } = useApp();
  const { allGenres } = useGameHelpers();
  const { openModal } = useModal();
  const [tab, setTabState] = useState<Tab>(savedTab);
  const setTab = (t: Tab) => setTabState((savedTab = t));
  const [collapsed, setCollapsedState] = useState(loadCollapsed);
  const toggleCollapsed = () => {
    saveCollapsed(!collapsed);
    setCollapsedState(!collapsed);
  };

  if (!user || !me) return <LoginRequired title="🕵️ 탐정 수첩" message="로그인하면 플레이한 게임과 취향을 기록할 수 있어요." />;

  const openDetail = (id: string) => openModal(<GameDetail gameId={id} />);
  const setField = (path: string, value: unknown) => store.setProfileField(user.uid, path, value).catch(showError);

  const playedIds = Object.keys(me.played || {}).filter((id) => games.some((g) => g.id === id));
  const likedIds = Object.keys(me.liked || {}).filter((id) => games.some((g) => g.id === id));
  const myRatings = playedIds.map((id) => me.played![id].rating).filter((r) => r > 0);
  const today = ymd();
  const myEvents = events.filter((e) => e.date >= today && e.participants?.[user.uid]).sort((a, b) => a.date.localeCompare(b.date));
  const prefGenres = me.prefGenres || [];
  const genres = [...new Set([...allGenres(), ...prefGenres])];
  // 프로필 문서를 받기 전/후로 폼 기본값이 달라지므로 key로 다시 마운트한다
  const profileLoaded = profiles.some((p) => p.id === user.uid);

  return (
    <div className="stack">
      <section className="card profile">
        <div className="profile-head">
          {user.photo ? (
            <img className="avatar lg" src={user.photo} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="avatar lg avatar-blank">🕵️</div>
          )}
          <ProfileForm key={`${user.uid}:${profileLoaded}`} me={me} />
        </div>
        <div className="stats">
          <div className="stat">
            <b>
              {playedIds.length}
              <small>/{games.length}</small>
            </b>
            <span>플레이한 게임</span>
          </div>
          <div className="stat">
            <b>{likedIds.length}</b>
            <span>선호 게임</span>
          </div>
          <div className="stat">
            <b>{myRatings.length ? (myRatings.reduce((a, b) => a + b, 0) / myRatings.length).toFixed(1) : "-"}</b>
            <span>내 평균 평점</span>
          </div>
          <div className="stat">
            <b>{myEvents.length}</b>
            <span>참여 예정</span>
          </div>
          {myEvents.length > 0 && (
            <div className="stat-wide">
              📅{" "}
              {myEvents.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && " · "}
                  <Link to="/schedule">
                    {prettyDate(e.date)} {e.gameName}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">선호하는 장르</h2>
        <div className="chips">
          {genres.length ? (
            genres.map((g) => (
              <button
                key={g}
                className={`chip ${prefGenres.includes(g) ? "on" : ""}`}
                onClick={() => setField("prefGenres", prefGenres.includes(g) ? prefGenres.filter((x) => x !== g) : [...prefGenres, g])}
              >
                {g}
              </button>
            ))
          ) : (
            <p className="muted small">게임을 등록하면 장르가 여기에 나타나요.</p>
          )}
        </div>
        <h2 className="section-title">선호하는 플레이 시간</h2>
        <div className="chips">
          {LENGTHS.map((l) => (
            <button key={l} className={`chip ${me.prefLength === l ? "on" : ""}`} onClick={() => setField("prefLength", me.prefLength === l ? null : l)}>
              {l}
            </button>
          ))}
        </div>
      </section>

      <Recommend me={me} onOpen={openDetail} />

      <section className="card">
        <div className="section-head">
          <h2 className="section-title">게임 기록</h2>
          <div className="section-head">
            {!collapsed && (
              <div className="seg">
                {TABS.map(([t, label]) => (
                  <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button className="btn btn-ghost btn-sm" aria-expanded={!collapsed} onClick={toggleCollapsed}>
              {collapsed ? "펼치기 ▾" : "접기 ▴"}
            </button>
          </div>
        </div>
        {collapsed ? (
          <p className="muted small">
            게임 기록 {games.length}개가 숨겨져 있어요. (플레이 {playedIds.length} · 선호 {likedIds.length} · 보유{" "}
            {Object.keys(me.owned || {}).filter((id) => games.some((g) => g.id === id)).length})
          </p>
        ) : (
          <Checklist me={me} tab={tab} onOpen={openDetail} />
        )}
      </section>

      <section className="card">
        <h2 className="section-title">친구들의 기록</h2>
        <Friends />
      </section>
    </div>
  );
}
