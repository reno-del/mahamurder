import { useState, type FormEvent } from "react";
import { store } from "../../store";
import { useApp, useGameHelpers, useMyName } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { showError, toast } from "../../lib/toast";
import { cleanName, displayName, players, ymd } from "../../lib/format";
import { setMonthView } from "../../lib/calendarView";
import type { EventFields, GameEvent } from "../../types";

interface Props {
  event?: GameEvent; // 있으면 수정
  date?: string;
  gameId?: string;
}

export function EventForm({ event, date, gameId }: Props) {
  const { user, me, games, profiles } = useApp();
  const { gameById } = useGameHelpers();
  const myName = useMyName();
  const { closeModal } = useModal();

  const initialGame = gameById(event?.gameId || gameId);
  const [gid, setGid] = useState(initialGame?.id || "");
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
    if (!user || !g) return;
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
        <label className="full">
          게임 *
          <select className="input" name="gameId" required value={gid} onChange={(e) => onGameChange(e.target.value)}>
            <option value="">선택하세요</option>
            {sorted.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({players(x)})
              </option>
            ))}
          </select>
        </label>
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
