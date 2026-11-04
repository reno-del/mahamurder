import { useState, type FormEvent } from "react";
import { store } from "../../store";
import { useApp, useGameHelpers, useMyName } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { showError, toast } from "../../lib/toast";
import { cleanName, displayName, players, ymd } from "../../lib/format";
import { setMonthView } from "../../lib/calendarView";
import { Cover } from "../../components/Cover";
import { categoryName, categoryOf } from "../../lib/category";
import type { EventFields, Game, GameEvent } from "../../types";

type Show = "owned" | "mine" | "all";

/**
 * 모집할 게임을 표지로 골라 주는 격자. 기본은 회원·미등록 친구 누군가가 가진 게임만 보여 준다.
 * 폼 안에 있으므로 버튼은 모두 type="button"이고, 검색칸에서 Enter를 눌러도 제출되지 않게 막는다.
 */
function EventGamePicker({ games, selected, onPick }: { games: Game[]; selected: string; onPick: (id: string) => void }) {
  const { user } = useApp();
  const { ownersOf } = useGameHelpers();
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("owned");

  const query = q.trim().toLowerCase();
  const counts: Record<Show, number> = { owned: 0, mine: 0, all: games.length };
  const list = games.filter((g) => {
    const owners = ownersOf(g.id);
    const mine = owners.some((o) => o.id === user?.uid);
    if (owners.length) counts.owned++;
    if (mine) counts.mine++;
    if (show === "owned" && !owners.length) return false;
    if (show === "mine" && !mine) return false;
    return !query || [g.name, g.publisher, categoryName(categoryOf(g))].join(" ").toLowerCase().includes(query);
  });
  const tabs: [Show, string][] = [
    ["owned", `보유 게임 ${counts.owned}`],
    ["mine", `내 게임 ${counts.mine}`],
    ["all", `전체 ${counts.all}`],
  ];

  return (
    <>
      <div className="picker-tools">
        <input
          className="input"
          type="search"
          placeholder="게임 이름, 분류, 제작사 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          autoFocus
        />
        <div className="seg">
          {tabs.map(([s, label]) => (
            <button type="button" key={s} className={show === s ? "on" : ""} onClick={() => setShow(s)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {list.length ? (
        <div className="picker-grid">
          {list.map((g) => {
            const owners = ownersOf(g.id);
            const on = g.id === selected;
            return (
              <button type="button" key={g.id} className={`picker-item ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onPick(g.id)}>
                <Cover game={g} className="picker-cover" />
                {on && <span className="picker-check">✔</span>}
                <span className="picker-name">{g.name}</span>
                <span className="tile-sub">
                  {players(g)}
                  {owners.length > 0 && (
                    <>
                      <br />📦 {owners.map((o) => (o.id === user?.uid ? "나" : o.name)).join(", ")}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="muted small picker-empty">
          {show === "all" || query ? "조건에 맞는 게임이 없어요." : "보유 게임이 없어요. '전체'에서 골라 보세요."}
        </p>
      )}
    </>
  );
}

interface Props {
  event?: GameEvent; // 있으면 수정
  date?: string;
  gameId?: string;
}

export function EventForm({ event, date, gameId }: Props) {
  const { user, me, games, profiles } = useApp();
  const { gameById, ownersOf } = useGameHelpers();
  const myName = useMyName();
  const { closeModal } = useModal();

  const initialGame = gameById(event?.gameId || gameId);
  const [gid, setGid] = useState(initialGame?.id || "");
  const [picking, setPicking] = useState(!initialGame);
  // 새 공지는 게임의 인원으로 기본값을 채운다
  const [minP, setMinP] = useState(String(event?.minPlayers ?? initialGame?.minPlayers ?? ""));
  const [maxP, setMaxP] = useState(String(event?.maxPlayers ?? initialGame?.maxPlayers ?? initialGame?.minPlayers ?? ""));

  const sorted = [...games].sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), "ko"));
  const g = gameById(gid);

  const onGameChange = (id: string) => {
    setGid(id);
    const ng = gameById(id);
    if (!ng) return;
    setMinP(String(ng.minPlayers || ""));
    setMaxP(String(ng.maxPlayers || ng.minPlayers || ""));
  };

  const onSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!user) return;
    if (!g) return toast("게임을 골라 주세요");
    const f = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>;
    const min = Number(minP);
    const max = Number(maxP);
    if (max < min) return toast("최대 인원이 최소 인원보다 작아요");
    const data: EventFields = {
      gameId: g.id,
      gameName: g.name,
      date: f.date,
      time: f.time,
      minPlayers: min,
      maxPlayers: max,
      place: f.place.trim(),
      note: f.note.trim(),
    };
    try {
      if (event) await store.updateEvent(event.id, data);
      else await store.createEvent({ ...data, hostUid: user.uid, hostName: myName, participants: { [user.uid]: myName } });
      closeModal();
      toast(event ? "수정했어요" : "모집 공지를 올렸어요 📢");
      const [y, m] = f.date.split("-").map(Number);
      setMonthView({ year: y, month: m - 1 });
    } catch (err) {
      showError(err);
    }
  };

  const playedFriends = g ? profiles.filter((p) => p.played?.[g.id]) : [];
  const fresh = g ? profiles.filter((p) => !p.played?.[g.id]) : [];
  const names = (ps: typeof profiles) => ps.map((p) => displayName(p) || "익명").join(", ");

  return (
    <>
      <h2>{event ? "모집 공지 수정" : "모집 공지 올리기"}</h2>
      <form className="form" onSubmit={onSubmit}>
        <div className="full">
          <div className="field-label">게임 *</div>
          {g && !picking ? (
            <div className="picked-game">
              <Cover game={g} className="cover-sm" />
              <div className="picked-info">
                <b>{g.name}</b>
                <div className="muted small">
                  {players(g)}
                  {ownersOf(g.id).length > 0 && <> · 📦 {ownersOf(g.id).map((o) => o.name).join(", ")}</>}
                </div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setPicking(true)}>
                다른 게임 고르기
              </button>
            </div>
          ) : (
            <EventGamePicker
              games={sorted}
              selected={gid}
              onPick={(id) => {
                onGameChange(id);
                setPicking(false);
              }}
            />
          )}
        </div>
        <p className="full small">
          {g && me?.played?.[g.id] && (
            <>
              <span className="warn">⚠ 내가 이미 플레이한 게임이에요.</span>
              <br />
            </>
          )}
          {playedFriends.length > 0 && (
            <>
              <span className="muted">이미 해 본 친구: {names(playedFriends)}</span>
              <br />
            </>
          )}
          {fresh.length > 0 && (
            <span className="muted">
              안 해 본 친구 {fresh.length}명: {names(fresh)}
            </span>
          )}
        </p>
        <label>
          날짜 *
          <input className="input" type="date" name="date" required min={ymd()} defaultValue={event?.date || date || ""} />
        </label>
        <label>
          시간
          <input className="input" type="time" name="time" defaultValue={event?.time || "19:00"} />
        </label>
        <label>
          최소 인원
          <input className="input" type="number" min="1" required value={minP} onChange={(e) => setMinP(e.target.value)} />
        </label>
        <label>
          최대 인원
          <input className="input" type="number" min="1" required value={maxP} onChange={(e) => setMaxP(e.target.value)} />
        </label>
        <label className="full">
          장소
          <input className="input" name="place" placeholder="예) 강남 ○○카페 / 우리집 / 디스코드" defaultValue={event?.place || ""} />
        </label>
        <label className="full">
          공지 내용
          <textarea className="input" name="note" rows={3} placeholder="준비물, 회비, 드레스코드 등" defaultValue={event?.note || ""} />
        </label>
        <div className="form-actions full">
          <button type="button" className="btn btn-ghost" data-close>
            취소
          </button>
          <button className="btn btn-primary">{event ? "수정" : "공지 올리기"}</button>
        </div>
      </form>
    </>
  );
}
