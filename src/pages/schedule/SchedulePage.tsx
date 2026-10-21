import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { LoginRequired } from "../../components/Layout";
import { toast } from "../../lib/toast";
import { ymd } from "../../lib/format";
import { Calendar } from "./Calendar";
import { EventCard, EventModal } from "./EventCard";
import { EventForm } from "./EventForm";
import { needsRecord, sortEv } from "./eventUtils";
import { usePageMeta } from "../../lib/usePageMeta";

export function SchedulePage() {
  const { user, me, games, events, eventsReady } = useApp();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();
  usePageMeta("일정 모집", "머더미스터리 게임 모임 일정을 달력으로 보고, 원하는 일정에 참가 신청합니다.", "schedule");
  // 게임 상세에서 "이 게임으로 모집하기"를 누르면 /schedule/new/<gameId> 로 들어온다.
  // 공유 링크 /schedule/<eventId> 로 들어오면 그 일정을 모달로 띄우고, 닫으면 /schedule 로 돌아간다.
  const { gameId, eventId } = useParams();

  const openForm = (opts: { date?: string; gameId?: string }) => {
    if (!games.length) return toast("먼저 게임 소개 페이지에서 게임을 등록해 주세요");
    openModal(<EventForm {...opts} />);
  };

  useEffect(() => {
    if (!gameId || !user || !games.length) return;
    navigate("/schedule", { replace: true });
    openModal(<EventForm gameId={gameId} />);
  }, [gameId, user, games.length, navigate, openModal]);

  const openedByRoute = useRef(false);
  useEffect(() => {
    if (!eventId) {
      // 뒤로 가기 등으로 주소에서 일정이 빠지면 띄워 둔 모달도 닫는다
      if (openedByRoute.current) closeModal();
      openedByRoute.current = false;
      return;
    }
    // 일정 목록을 받은 뒤에 연다. 지워진 일정이면 EventModal이 안내 문구를 보여 준다
    if (!user || !eventsReady) return;
    openedByRoute.current = true;
    openModal(<EventModal eventId={eventId} />, {
      onClose: () => {
        openedByRoute.current = false;
        if (window.location.pathname === `/schedule/${eventId}`) navigate("/schedule");
      },
    });
  }, [eventId, user, eventsReady, navigate, openModal, closeModal]);

  if (!user)
    return (
      <LoginRequired
        title="📅 일정 모집"
        message={eventId ? "친구가 보낸 모집 공지예요. 로그인하면 바로 보고 참여할 수 있어요." : "로그인하면 친구들의 모집 공지를 보고 참여할 수 있어요."}
      />
    );

  const today = ymd();
  const upcoming = events.filter((e) => e.date >= today).sort(sortEv);
  const past = events
    .filter((e) => e.date < today)
    .sort(sortEv)
    .reverse();
  const toRecord = past.filter((e) => needsRecord(e, user.uid, me));

  return (
    <div className="stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">일정 모집</h1>
          <p className="muted">달력에서 날짜를 눌러 "이 날 이 게임 할 사람!" 공지를 올려 보세요.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openForm({})}>
          + 모집 공지 올리기
        </button>
      </section>
      {toRecord.length > 0 && (
        <section>
          <h2 className="section-title">📝 다녀온 모임 기록하기</h2>
          <p className="muted small">플레이 기록을 남기면 친구들이 같은 게임으로 모집할 때 스포일러 경고가 떠요.</p>
          <div className="board to-record">
            {toRecord.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="section-title">📢 모집 공지</h2>
        <div className="board">
          {upcoming.length ? (
            upcoming.map((e) => <EventCard key={e.id} event={e} />)
          ) : (
            <div className="empty">아직 모집 중인 일정이 없어요. 첫 공지를 올려 보세요!</div>
          )}
        </div>
      </section>
      <Calendar
        onDayClick={(date) => (date < today ? toast("지난 날짜에는 모집할 수 없어요") : openForm({ date }))}
        onEventClick={(id) => navigate(`/schedule/${id}`)}
      />
      <details className="card past-wrap">
        <summary>지난 일정</summary>
        <div className="board">
          {past.length ? past.map((e) => <EventCard key={e.id} event={e} />) : <p className="muted small">지난 일정이 없어요.</p>}
        </div>
      </details>
    </div>
  );
}
