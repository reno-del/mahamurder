import { useNavigate } from "react-router-dom";
import { store } from "../../store";
import { useApp, useGameHelpers, useMyName } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { showError, toast } from "../../lib/toast";
import { cleanName, displayName, prettyDate, ymd } from "../../lib/format";
import { GameDetail } from "../games/GameDetail";
import { EventForm } from "./EventForm";
import { alreadyPlayed, count, dday, status } from "./eventUtils";
import type { GameEvent } from "../../types";

export function EventCard({ event: e }: { event: GameEvent }) {
  const { user, me, profiles } = useApp();
  const myName = useMyName();
  const { openModal, closeModal } = useModal();
  const { markPlayed, setRating } = useGameHelpers();
  const navigate = useNavigate();
  if (!user) return null;

  const nameOf = (uid: string, fallback: string) => displayName(profiles.find((p) => p.id === uid)) || fallback;
  const st = status(e);
  const n = count(e);
  const mine = !!e.participants?.[user.uid];
  const isHost = e.hostUid === user.uid;
  const past = e.date < ymd();
  const spoiled = alreadyPlayed(e, profiles);
  const myPlay = me?.played?.[e.gameId];
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
  // 카톡방에 그대로 붙여 넣을 수 있게 일정 요약과 링크를 함께 복사한다
  const share = run(async () => {
    const limit = e.minPlayers === e.maxPlayers ? e.maxPlayers : `${e.minPlayers}~${e.maxPlayers}`;
    const text = [
      `[머더미스터리 모임] ${cleanName(e.gameName)}`,
      `${prettyDate(e.date)} ${e.time || ""}${e.place ? ` · 📍${e.place}` : ""}`.trim(),
      `현재 ${n}/${limit}명 모집 중`,
      `${location.origin}/schedule/${e.id}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("공유 링크를 복사했어요. 카톡방에 붙여 넣어 보세요");
    } catch {
      // 카톡 인앱 브라우저 등 클립보드를 못 쓰는 곳에서는 직접 복사하게 보여 준다
      prompt("아래 내용을 복사해 공유하세요", text);
    }
  });
  // 링크로 연 일정 모달에서 게임 상세로 바뀐 뒤 닫으면 주소도 /schedule 로 돌린다
  const openGame = () =>
    openModal(<GameDetail gameId={e.gameId} />, {
      onClose: () => {
        if (window.location.pathname === `/schedule/${e.id}`) navigate("/schedule");
      },
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
        {!past && <span className={`status status-${st.cls}`}>{st.label}</span>}
      </div>
      <button className="link-btn event-game" onClick={openGame}>
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
      {spoiled.length > 0 &&
        (past ? (
          <p className="muted small">✔ 플레이 기록 남긴 참가자: {spoiled.map((uid) => nameOf(uid, e.participants![uid])).join(", ")}</p>
        ) : (
          <p className="warn">⚠ 이미 플레이한 참가자: {spoiled.map((uid) => nameOf(uid, e.participants![uid])).join(", ")}</p>
        ))}
      {past && mine && (
        <div className="event-actions">
          {myPlay ? (
            <div className="my-rating">
              내 평점{" "}
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  className={`star-btn sm ${myPlay.rating >= r ? "on" : ""}`}
                  aria-label={`${r}점`}
                  onClick={() => setRating(e.gameId, r)}
                >
                  ★
                </button>
              ))}
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => markPlayed(e.gameId, e.date)}>
              ✔ 다녀왔어요 (플레이 기록)
            </button>
          )}
        </div>
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
          <button className="btn btn-sm" onClick={share}>
            🔗 공유 링크 복사
          </button>
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
