import { store } from "../../store";
import { useApp, useMyName } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { showError, toast } from "../../lib/toast";
import { displayName, prettyDate, ymd } from "../../lib/format";
import { GameDetail } from "../games/GameDetail";
import { EventForm } from "./EventForm";
import { alreadyPlayed, count, dday, status } from "./eventUtils";
import type { GameEvent } from "../../types";

export function EventCard({ event: e }: { event: GameEvent }) {
  const { user, me, profiles } = useApp();
  const myName = useMyName();
  const { openModal, closeModal } = useModal();
  if (!user) return null;

  const nameOf = (uid: string, fallback: string) => displayName(profiles.find((p) => p.id === uid)) || fallback;
  const st = status(e);
  const n = count(e);
  const mine = !!e.participants?.[user.uid];
  const isHost = e.hostUid === user.uid;
  const past = e.date < ymd();
  const spoiled = alreadyPlayed(e, profiles);
  const pct = Math.min(100, (n / (e.maxPlayers || e.minPlayers || n || 1)) * 100);

  const run = (fn: () => Promise<void>) => () => fn().catch(showError);
  const join = run(async () => {
    if (me?.played?.[e.gameId] && !confirm("이미 플레이한 게임이에요. 그래도 참여할까요? (스포일러 주의)")) return;
    await store.joinEvent(e.id, { uid: user.uid, name: myName });
    toast("참여했어요!");
  });
  const leave = run(async () => {
    await store.leaveEvent(e.id, user.uid);
    toast("참여를 취소했어요");
  });
  const remove = run(async () => {
    if (!confirm("이 모집 공지를 삭제할까요?")) return;
    await store.deleteEvent(e.id);
    closeModal();
  });

  return (
    <article className={`card event ${past ? "past" : ""}`}>
      <div className="event-head">
        <div>
          <span className="dday">{past ? "지난 일정" : dday(e.date)}</span>
          <h3>
            {prettyDate(e.date)} {e.time || ""}
          </h3>
        </div>
        <span className={`status status-${st.cls}`}>{st.label}</span>
      </div>
      <button className="link-btn event-game" onClick={() => openModal(<GameDetail gameId={e.gameId} />)}>
        🎭 {e.gameName}
      </button>
      <p className="muted small">
        {e.place && `📍 ${e.place} · `}주최 {nameOf(e.hostUid, e.hostName)}
      </p>
      {e.note && <p className="note">{e.note}</p>}
      <div className="progress">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="small">
        <b>{n}</b> / {e.minPlayers === e.maxPlayers ? e.maxPlayers : `${e.minPlayers}~${e.maxPlayers}`}명
      </p>
      <ul className="people inline">
        {Object.entries(e.participants || {}).map(([uid, name]) => (
          <li key={uid} className={uid === e.hostUid ? "host" : ""}>
            {nameOf(uid, name)}
          </li>
        ))}
      </ul>
      {spoiled.length > 0 && (
        <p className="warn">⚠ 이미 플레이한 참가자: {spoiled.map((uid) => nameOf(uid, e.participants![uid])).join(", ")}</p>
      )}
      {!past && (
        <div className="event-actions">
          {mine ? (
            !isHost && (
              <button className="btn btn-sm" onClick={leave}>
                참여 취소
              </button>
            )
          ) : (
            <button className="btn btn-primary btn-sm" onClick={join} disabled={st.cls === "full"}>
              참여하기
            </button>
          )}
          {isHost && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => openModal(<EventForm event={e} />)}>
                수정
              </button>
              <button className="btn btn-ghost btn-sm danger" onClick={remove}>
                취소(삭제)
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** 달력에서 일정을 눌렀을 때 모달 내용. 데이터가 바뀌면 자동으로 최신 상태가 된다. */
export function EventModal({ eventId }: { eventId: string }) {
  const { events } = useApp();
  const e = events.find((x) => x.id === eventId);
  return e ? <EventCard event={e} /> : <p className="muted">삭제된 일정이에요.</p>;
}
