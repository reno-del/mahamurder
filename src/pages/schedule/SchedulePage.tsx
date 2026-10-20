import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { LoginRequired } from "../../components/Layout";
import { toast } from "../../lib/toast";
import { ymd } from "../../lib/format";
import { Calendar } from "./Calendar";
import { EventCard, EventModal } from "./EventCard";
import { EventForm } from "./EventForm";
import { sortEv } from "./eventUtils";

export function SchedulePage() {
  const { user, games, events } = useApp();
  const { openModal } = useModal();
  const navigate = useNavigate();
  // 게임 상세에서 "이 게임으로 모집하기"를 누르면 /schedule/new/<gameId> 로 들어온다.
  const { gameId } = useParams();

  const openForm = (opts: { date?: string; gameId?: string }) => {
    if (!games.length) return toast("먼저 게임 소개 페이지에서 게임을 등록해 주세요");
    openModal(<EventForm {...opts} />);
  };

  useEffect(() => {
    if (!gameId || !user || !games.length) return;
    navigate("/schedule", { replace: true });
    openModal(<EventForm gameId={gameId} />);
  }, [gameId, user, games.length, navigate, openModal]);

  if (!user) return <LoginRequired title="📅 일정 모집" message="로그인하면 친구들의 모집 공지를 보고 참여할 수 있어요." />;

  const today = ymd();
  const upcoming = events.filter((e) => e.date >= today).sort(sortEv);
  const past = events
    .filter((e) => e.date < today)
    .sort(sortEv)
    .reverse();

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
        onEventClick={(id) => openModal(<EventModal eventId={id} />)}
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
