// HTML 이스케이프 (사용자 입력을 innerHTML에 넣을 때 반드시 사용)
export const h = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const won = (n) => (n || n === 0 ? `${Number(n).toLocaleString("ko-KR")}원` : "가격 미정");

export function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export function prettyDate(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${WEEK[dt.getDay()]})`;
}

export function stars(rating) {
  const r = Math.round(Number(rating) || 0);
  return "★".repeat(r) + "☆".repeat(5 - r);
}

export const players = (g) =>
  !g.minPlayers ? "인원 미정" : g.minPlayers === g.maxPlayers || !g.maxPlayers ? `${g.minPlayers}인` : `${g.minPlayers}~${g.maxPlayers}인`;

export const playTime = (m) => (!m ? "" : m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`);

export function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

// 모달: html 문자열을 넣고 열기. 반환된 dialog 요소에 이벤트를 걸면 된다.
export function openModal(html) {
  const dlg = document.getElementById("modal");
  dlg.innerHTML = `<button class="modal-close" data-close aria-label="닫기">✕</button>${html}`;
  dlg.onclick = (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
  };
  if (!dlg.open) dlg.showModal();
  return dlg;
}
export const closeModal = () => document.getElementById("modal").close();
