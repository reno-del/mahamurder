import { useMemo, useState } from "react";
import { useApp, useGameHelpers, type Owner } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { LoginRequired } from "../../components/Layout";
import { GameTiles } from "../../components/GameTiles";
import { cleanName, displayName, players, playTime } from "../../lib/format";
import { GameDetail } from "../games/GameDetail";
import { usePageMeta } from "../../lib/usePageMeta";
import { MAX_PEOPLE, splitTeams } from "../../lib/teamSplit";
import type { Game } from "../../types";

type Source = "attending" | "all";

// 다른 페이지에 다녀와도 고른 사람이 유지되도록 모듈에 보관 (null = 처음 들어옴, 나만 고른 상태로 시작)
let savedPicked: string[] | null = null;
let savedSource: Source = "attending";
let savedFitOnly = true;
let savedTeamCount = 2;

// 인원 정보가 없으면 null, 있으면 지금 인원으로 할 수 있는지
function fits(g: Game, n: number) {
  if (!g.minPlayers) return null;
  return g.minPlayers <= n && n <= (g.maxPlayers || g.minPlayers);
}

/**
 * 오늘 같이 할 사람을 고르면, 그 사람들이 가진 게임(또는 친구 전체가 가진 게임) 중
 * 고른 회원 누구도 해 보지 않은 게임을 보여 준다.
 * 미등록 친구는 플레이 기록이 없어서 보유 게임만 더해진다.
 */
export function TonightPage() {
  const { user, games, profiles, guests } = useApp();
  const { copiesOf } = useGameHelpers();
  const { openModal } = useModal();
  const [pickedState, setPickedState] = useState(savedPicked);
  const [source, setSourceState] = useState<Source>(savedSource);
  const [fitOnly, setFitOnlyState] = useState(savedFitOnly);
  const [teamCount, setTeamCountState] = useState(savedTeamCount);
  usePageMeta("오늘 뭐 하지", "오늘 모인 친구들이 아직 안 해 본 보유 게임을 찾아 줍니다.", "tonight");

  if (!user) return <LoginRequired title="🎲 오늘 뭐 하지" message="로그인하면 오늘 모인 친구들이 안 해 본 게임을 찾아 줘요." />;

  const picked = pickedState || [user.uid];
  const setPicked = (ids: string[]) => setPickedState((savedPicked = ids));
  const setSource = (s: Source) => setSourceState((savedSource = s));
  const setFitOnly = (v: boolean) => setFitOnlyState((savedFitOnly = v));
  const setTeamCount = (k: number) => setTeamCountState((savedTeamCount = k));
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id]);

  // 나를 먼저, 그다음 이름순
  const people: Owner[] = [
    ...profiles
      .map((p) => ({ id: p.id, name: p.id === user.uid ? "나" : displayName(p) || "익명" }))
      .sort((a, b) => Number(b.id === user.uid) - Number(a.id === user.uid) || a.name.localeCompare(b.name, "ko")),
    ...[...guests].sort((a, b) => a.name.localeCompare(b.name, "ko")).map((g) => ({ id: g.id, name: g.name, guest: true })),
  ];
  // 지워진 친구가 남아 있지 않게 지금 있는 사람만 센다
  const attending = people.filter((p) => picked.includes(p.id));
  const members = profiles.filter((p) => picked.includes(p.id));
  const n = attending.length;
  const nameOf = (o: Owner) => (o.id === user.uid ? "나" : o.name);

  const owned = games.filter((g) => copiesOf(g).some((c) => source === "all" || picked.includes(c.owner.id)));
  const fresh = owned.filter((g) => !members.some((p) => p.played?.[g.id]));
  const shown = fresh
    .filter((g) => !fitOnly || fits(g, n))
    // 인원이 맞는 게임, 고른 사람들이 선호 표시를 많이 한 게임, 평점 순
    .map((g) => ({
      g,
      score: (fits(g, n) ? 100 : 0) + members.filter((p) => p.liked?.[g.id]).length * 10 + (g.rating || 0),
    }))
    .sort((a, b) => b.score - a.score || cleanName(a.g.name).localeCompare(cleanName(b.g.name), "ko"))
    .map(({ g }) => g);

  const sub = (g: Game) => {
    const copies = copiesOf(g);
    const mine = copies.filter((c) => picked.includes(c.owner.id));
    const free = copies.filter((c) => !c.rental);
    const likedBy = members.filter((p) => p.liked?.[g.id]).length;
    const fit = fits(g, n);
    return (
      <>
        {fit === false ? <span className="badge badge-rented">{players(g)}</span> : players(g)}
        {g.playTime ? ` · ${playTime(g.playTime)}` : ""}
        {likedBy > 0 && ` · ♥${likedBy}`}
        <br />
        📦{" "}
        {mine.length
          ? mine.map((c) => nameOf(c.owner)).join(", ")
          : free.length
            ? `${free.map((c) => nameOf(c.owner)).join(", ")}에게 빌리기`
            : "모두 대여 중"}
      </>
    );
  };

  return (
    <div className="stack">
      <section className="card">
        <h1 className="section-title">🎲 오늘 뭐 하지</h1>
        <p className="muted small">
          오늘 같이 할 사람을 고르면, 가진 게임 중 아무도 안 해 본 게임을 보여 줘요. 미등록 친구는 플레이 기록이 없어서 그 친구의
          보유 게임만 더해져요.
        </p>
        <div className="section-head">
          <h2 className="section-title">함께하는 사람 ({n}명)</h2>
          {n > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setPicked([user.uid])}>
              나만 남기기
            </button>
          )}
        </div>
        <div className="chips">
          {people.map((p) => (
            <button key={p.id} className={`chip ${picked.includes(p.id) ? "on" : ""}`} aria-pressed={picked.includes(p.id)} onClick={() => toggle(p.id)}>
              {picked.includes(p.id) ? "✔ " : "+ "}
              {p.name}
              {p.guest && " (미등록)"}
            </button>
          ))}
        </div>
        <div className="picker-tools">
          <div className="seg">
            <button className={source === "attending" ? "on" : ""} onClick={() => setSource("attending")}>
              온 사람이 가진 게임
            </button>
            <button className={source === "all" ? "on" : ""} onClick={() => setSource("all")}>
              친구 전체 보유 게임
            </button>
          </div>
          <label className="check-label">
            <input type="checkbox" checked={fitOnly} onChange={(e) => setFitOnly(e.target.checked)} />
            {n}명이 할 수 있는 게임만
          </label>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">
          🔎 아무도 안 해 본 게임 ({shown.length})
          <span className="muted small"> · 보유 게임 {owned.length}개 중 누군가 해 본 {owned.length - fresh.length}개 제외</span>
        </h2>
        <GameTiles
          key={`${picked.join()}:${source}:${fitOnly}`}
          games={shown}
          onOpen={(id) => openModal(<GameDetail gameId={id} />)}
          sub={sub}
          empty={
            !n
              ? "함께하는 사람을 골라 주세요."
              : !owned.length
                ? "고른 사람들이 가진 게임이 없어요. '친구 전체 보유 게임'으로 바꿔 보세요."
                : fitOnly && fresh.length
                  ? `${n}명이 할 수 있는 게임이 없어요. 인원 조건을 꺼 보세요.`
                  : "다들 이미 해 본 게임뿐이에요. '친구 전체 보유 게임'으로 바꿔 보세요."
          }
        />
      </section>

      {n >= 4 && (
        <TeamSplits
          attending={attending}
          pool={owned}
          teamCount={teamCount}
          setTeamCount={setTeamCount}
          nameOf={nameOf}
          onOpen={(id) => openModal(<GameDetail gameId={id} />)}
        />
      )}
    </div>
  );
}

/** 함께하는 사람을 2~3팀으로 나눠 팀마다 아무도 안 해 본 게임을 하나씩 하는 경우의 수 */
function TeamSplits({
  attending,
  pool,
  teamCount,
  setTeamCount,
  nameOf,
  onOpen,
}: {
  attending: Owner[];
  /** 찾을 범위(보유 게임) */
  pool: Game[];
  teamCount: number;
  setTeamCount: (k: number) => void;
  nameOf: (o: Owner) => string;
  onOpen: (id: string) => void;
}) {
  const { games, profiles } = useApp();
  const n = attending.length;
  // attending·pool은 렌더링마다 새 배열이라, 바뀌었는지는 id 목록과 원본 구독 값으로 본다
  const idsKey = attending.map((o) => o.id).join();
  const poolKey = pool.map((g) => g.id).join();
  const counts = [2, 3].filter((k) => n >= k * 2);
  const k = counts.includes(teamCount) ? teamCount : 2;
  const { splits, total } = useMemo(() => {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return splitTeams({
      ids: attending.map((o) => o.id),
      games: pool,
      k,
      played: (id, g) => !!byId.get(id)?.played?.[g.id],
      // 팀원이 선호 표시를 많이 한 게임, 평점 순
      score: (g, team) => team.filter((id) => byId.get(id)?.liked?.[g.id]).length * 10 + (g.rating || 0),
    });
  }, [idsKey, poolKey, games, profiles, k]);
  const ownerOf = new Map(attending.map((o) => [o.id, o]));
  const tooMany = n > (MAX_PEOPLE[k] ?? 0);

  return (
    <section className="card">
      <div className="section-head">
        <h2 className="section-title">👥 팀 나눠서 하기</h2>
        {counts.length > 1 && (
          <div className="seg">
            {counts.map((c) => (
              <button key={c} className={k === c ? "on" : ""} onClick={() => setTeamCount(c)}>
                {c}팀
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="muted small">
        {n}명을 {k}팀으로 나눠, 팀마다 팀원 아무도 안 해 본 게임을 하나씩 하는 경우예요. 고를 수 있는 게임이 많고 인원이 고른 나누기부터
        보여 줘요. 게임은 위에서 고른 보유 게임 범위 안에서 찾아요.
      </p>
      {tooMany ? (
        <p className="muted small">사람이 너무 많아 {k}팀 경우의 수는 계산하지 않아요.</p>
      ) : !splits.length ? (
        <p className="muted small">팀마다 안 해 본 게임이 하나씩 돌아가는 나누기가 없어요. 팀 수나 보유 게임 범위를 바꿔 보세요.</p>
      ) : (
        <>
          <p className="small">
            가능한 나누기 <b>{total}가지</b>
            {total > splits.length && ` 중 ${splits.length}가지`}
          </p>
          <ol className="split-list">
            {splits.map((teams, i) => (
              <li key={i} className="split-item">
                {teams.map((t, j) => (
                  <div key={j} className="split-team">
                    <span className="split-label">{String.fromCharCode(65 + j)}팀</span>
                    <span className="split-names">{t.ids.map((id) => nameOf(ownerOf.get(id)!)).join(", ")}</span>
                    <button className="link-btn" onClick={() => onOpen(t.pick.id)}>
                      🎲 {t.pick.name}
                    </button>
                    <span className="muted small">
                      {players(t.pick)}
                      {t.options > 1 && ` · 다른 후보 ${t.options - 1}개`}
                    </span>
                  </div>
                ))}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
