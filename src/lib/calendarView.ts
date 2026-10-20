// 일정 달력에서 보고 있는 달. 페이지를 나갔다 와도, 모달(페이지 트리 밖)에서 공지를 저장해도 유지·이동되도록 모듈에 둔다.
import { useSyncExternalStore } from "react";

export interface MonthView {
  year: number;
  month: number; // 0~11
}

const thisMonth = (): MonthView => ({ year: new Date().getFullYear(), month: new Date().getMonth() });

let view = thisMonth();
const subs = new Set<() => void>();

export function setMonthView(next: MonthView) {
  view = next;
  subs.forEach((f) => f());
}

export function shiftMonth(delta: number) {
  if (delta === 0) return setMonthView(thisMonth());
  const d = new Date(view.year, view.month + delta, 1);
  setMonthView({ year: d.getFullYear(), month: d.getMonth() });
}

export function useMonthView() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => view
  );
}
