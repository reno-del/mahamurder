import { useApp } from "../../state/AppContext";
import { cleanName, ymd } from "../../lib/format";
import { shiftMonth, useMonthView } from "../../lib/calendarView";
import { count, sortEv, status } from "./eventUtils";
import type { GameEvent } from "../../types";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  onDayClick: (date: string) => void;
  onEventClick: (id: string) => void;
}

export function Calendar({ onDayClick, onEventClick }: Props) {
  const { user, events } = useApp();
  const { year, month } = useMonthView();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const today = ymd();
  const byDate: Record<string, GameEvent[]> = {};
  events.forEach((e) => (byDate[e.date] ||= []).push(e));

  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));

  return (
    <section className="card">
      <div className="cal-head">
        <button className="btn btn-ghost btn-sm" aria-label="이전 달" onClick={() => shiftMonth(-1)}>
          ◀
        </button>
        <h2>
          {year}년 {month + 1}월
        </h2>
        <button className="btn btn-ghost btn-sm" aria-label="다음 달" onClick={() => shiftMonth(1)}>
          ▶
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => shiftMonth(0)}>
          오늘
        </button>
      </div>
      <div className="cal">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = ymd(d);
          const cls = [
            "cal-day",
            d.getMonth() !== month && "other",
            key === today && "today",
            key < today && "past",
            d.getDay() === 0 && "sun",
            d.getDay() === 6 && "sat",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={key} className={cls} title={key < today ? "" : "클릭해서 모집 공지 올리기"} onClick={() => onDayClick(key)}>
              <span className="cal-num">{d.getDate()}</span>
              {(byDate[key] || []).sort(sortEv).map((e) => (
                <button
                  key={e.id}
                  className={`cal-ev st-${status(e).cls} ${user && e.participants?.[user.uid] ? "mine" : ""}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onEventClick(e.id);
                  }}
                >
                  {e.time || ""} {cleanName(e.gameName)}{" "}
                  <b>
                    {count(e)}/{e.maxPlayers}
                  </b>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
