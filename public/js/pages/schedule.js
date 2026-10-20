import { store } from "../store.js";
import { state, displayName, showError } from "../app.js";
import { h, prettyDate, ymd, openModal, closeModal, toast, players } from "../util.js";
import { gameById, cleanName, openGameDetail } from "./games.js";

const view = { year: new Date().getFullYear(), month: new Date().getMonth() };

const count = (e) => Object.keys(e.participants || {}).length;
const sortEv = (a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));
const nameOf = (uid, fallback) => displayName(state.profiles.find((p) => p.id === uid)) || fallback;

function status(e) {
  const n = count(e);
  if (e.maxPlayers && n >= e.maxPlayers) return { cls: "full", label: "모집 완료" };
  if (n >= (e.minPlayers || 1)) return { cls: "ok", label: "진행 확정 · 추가 모집" };
  return { cls: "open", label: `${(e.minPlayers || 1) - n}명 더 필요` };
}

function dday(date) {
  const [y, m, d] = date.split("-").map(Number);
  const diff = Math.round((new Date(y, m - 1, d) - new Date(new Date().toDateString())) / 864e5);
  return diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

// 머더미스터리는 한 번만 플레이할 수 있으므로, 이미 해 본 참가자를 경고로 보여준다.
function alreadyPlayed(e) {
  return Object.keys(e.participants || {}).filter((uid) => state.profiles.find((p) => p.id === uid)?.played?.[e.gameId]);
}

function eventCardHtml(e) {
  const st = status(e);
  const n = count(e);
  const mine = !!e.participants?.[state.user.uid];
  const isHost = e.hostUid === state.user.uid;
  const past = e.date < ymd();
  const spoiled = alreadyPlayed(e);
  const pct = Math.min(100, (n / (e.maxPlayers || e.minPlayers || n || 1)) * 100);
  return `
  <article class="card event ${past ? "past" : ""}" id="ev-${h(e.id)}">
    <div class="event-head">
      <div>
        <span class="dday">${past ? "지난 일정" : dday(e.date)}</span>
        <h3>${prettyDate(e.date)} ${h(e.time || "")}</h3>
      </div>
      <span class="status status-${st.cls}">${st.label}</span>
    </div>
    <button class="link-btn event-game" data-game="${h(e.gameId)}">🎭 ${h(e.gameName)}</button>
    <p class="muted small">${e.place ? `📍 ${h(e.place)} · ` : ""}주최 ${h(nameOf(e.hostUid, e.hostName))}</p>
    ${e.note ? `<p class="note">${h(e.note)}</p>` : ""}
    <div class="progress"><span style="width:${pct}%"></span></div>
    <p class="small"><b>${n}</b> / ${e.minPlayers === e.maxPlayers ? e.maxPlayers : `${e.minPlayers}~${e.maxPlayers}`}명</p>
    <ul class="people inline">
      ${Object.entries(e.participants || {})
        .map(([uid, name]) => `<li class="${uid === e.hostUid ? "host" : ""}">${h(nameOf(uid, name))}</li>`)
        .join("")}
    </ul>
    ${
      spoiled.length
        ? `<p class="warn">⚠ 이미 플레이한 참가자: ${spoiled.map((uid) => h(nameOf(uid, e.participants[uid]))).join(", ")}</p>`
        : ""
    }
    ${
      past
        ? ""
        : `<div class="event-actions">
          ${
            mine
              ? isHost
                ? ""
                : `<button class="btn btn-sm" data-leave="${h(e.id)}">참여 취소</button>`
              : `<button class="btn btn-primary btn-sm" data-join="${h(e.id)}" ${st.cls === "full" ? "disabled" : ""}>참여하기</button>`
          }
          ${isHost ? `<button class="btn btn-ghost btn-sm" data-edit="${h(e.id)}">수정</button>` : ""}
          ${isHost ? `<button class="btn btn-ghost btn-sm danger" data-del="${h(e.id)}">취소(삭제)</button>` : ""}
        </div>`
    }
  </article>`;
}

// 공지 카드·모달 공통 버튼 처리. 처리 후 true 반환
async function handleAction(t) {
  const ev = (id) => state.events.find((e) => e.id === id);
  try {
    if (t.dataset.join) {
      const e = ev(t.dataset.join);
      if (state.me?.played?.[e.gameId] && !confirm("이미 플레이한 게임이에요. 그래도 참여할까요? (스포일러 주의)")) return true;
      await store.joinEvent(e.id, { uid: state.user.uid, name: displayName(state.me) || state.user.name });
      toast("참여했어요!");
    } else if (t.dataset.leave) {
      await store.leaveEvent(t.dataset.leave, state.user.uid);
      toast("참여를 취소했어요");
    } else if (t.dataset.del) {
      if (!confirm("이 모집 공지를 삭제할까요?")) return true;
      await store.deleteEvent(t.dataset.del);
      closeModal();
    } else if (t.dataset.edit) {
      openEventForm({ event: ev(t.dataset.edit) });
    } else if (t.dataset.game) {
      openGameDetail(t.dataset.game);
    } else return false;
  } catch (err) {
    showError(err);
  }
  return true;
}

export function renderSchedule(root, params) {
  if (!state.user) {
    root.dataset.page = "";
    root.innerHTML = `
      <section class="empty big">
        <h2>📅 일정 모집</h2>
        <p class="muted">로그인하면 친구들의 모집 공지를 보고 참여할 수 있어요.</p>
        <button class="btn btn-primary" id="login3">로그인</button>
      </section>`;
    root.querySelector("#login3").onclick = () => store.login().catch(showError);
    return;
  }

  if (root.dataset.page !== "schedule") {
    root.dataset.page = "schedule";
    root.innerHTML = `<div id="sc" class="stack">
      <section class="section-head">
        <div>
          <h1 class="page-title">일정 모집</h1>
          <p class="muted">달력에서 날짜를 눌러 "이 날 이 게임 할 사람!" 공지를 올려 보세요.</p>
        </div>
        <button class="btn btn-primary" id="new-ev">+ 모집 공지 올리기</button>
      </section>
      <section>
        <h2 class="section-title">📢 모집 공지</h2>
        <div id="board" class="board"></div>
      </section>
      <section class="card">
        <div class="cal-head">
          <button class="btn btn-ghost btn-sm" data-month="-1" aria-label="이전 달">◀</button>
          <h2 id="cal-title"></h2>
          <button class="btn btn-ghost btn-sm" data-month="1" aria-label="다음 달">▶</button>
          <button class="btn btn-ghost btn-sm" data-month="0">오늘</button>
        </div>
        <div id="cal" class="cal"></div>
      </section>
      <details class="card past-wrap">
        <summary>지난 일정</summary>
        <div id="past" class="board"></div>
      </details></div>`;

    const sc = root.querySelector("#sc");
    sc.querySelector("#new-ev").onclick = () => openEventForm({});
    sc.addEventListener("click", async (e) => {
      const t = e.target.closest("button, [data-day], [data-ev]");
      if (!t) return;
      if (t.dataset.month !== undefined) {
        const d = Number(t.dataset.month);
        if (d === 0) Object.assign(view, { year: new Date().getFullYear(), month: new Date().getMonth() });
        else {
          const dt = new Date(view.year, view.month + d, 1);
          Object.assign(view, { year: dt.getFullYear(), month: dt.getMonth() });
        }
        renderSchedule(root, []);
      } else if (t.dataset.ev) {
        openEventModal(t.dataset.ev);
      } else if (t.dataset.day) {
        if (t.dataset.day < ymd()) return toast("지난 날짜에는 모집할 수 없어요");
        openEventForm({ date: t.dataset.day });
      } else {
        await handleAction(t);
      }
    });
  }

  const today = ymd();
  const upcoming = state.events.filter((e) => e.date >= today).sort(sortEv);
  const past = state.events.filter((e) => e.date < today).sort(sortEv).reverse();

  root.querySelector("#board").innerHTML = upcoming.length
    ? upcoming.map(eventCardHtml).join("")
    : `<div class="empty">아직 모집 중인 일정이 없어요. 첫 공지를 올려 보세요!</div>`;
  root.querySelector("#past").innerHTML = past.length ? past.map(eventCardHtml).join("") : `<p class="muted small">지난 일정이 없어요.</p>`;

  renderCalendar(root);

  // 게임 상세에서 "이 게임으로 모집하기"를 누르면 #/schedule/new/<gameId> 로 들어온다.
  if (params[0] === "new") {
    history.replaceState(null, "", "#/schedule");
    openEventForm({ gameId: params[1] });
  }
}

function renderCalendar(root) {
  const { year, month } = view;
  root.querySelector("#cal-title").textContent = `${year}년 ${month + 1}월`;
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const today = ymd();
  const byDate = {};
  state.events.forEach((e) => (byDate[e.date] ||= []).push(e));

  let html = ["일", "월", "화", "수", "목", "금", "토"].map((d) => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = ymd(d);
    const evs = (byDate[key] || []).sort(sortEv);
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
    html += `
      <div class="${cls}" data-day="${key}" title="${key < today ? "" : "클릭해서 모집 공지 올리기"}">
        <span class="cal-num">${d.getDate()}</span>
        ${evs
          .map((e) => {
            const mine = e.participants?.[state.user.uid];
            return `<button class="cal-ev st-${status(e).cls} ${mine ? "mine" : ""}" data-ev="${h(e.id)}">
              ${h(e.time || "")} ${h(cleanName(e.gameName))} <b>${count(e)}/${e.maxPlayers}</b></button>`;
          })
          .join("")}
      </div>`;
  }
  root.querySelector("#cal").innerHTML = html;
}

function openEventModal(id) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return closeModal();
  const dlg = openModal(eventCardHtml(e));
  dlg.querySelectorAll("button[data-join],button[data-leave],button[data-edit],button[data-del],button[data-game]").forEach(
    (b) =>
      (b.onclick = async () => {
        await handleAction(b);
        // 상세/수정 모달로 바뀐 경우가 아니면 최신 상태로 다시 그린다
        if (b.dataset.join || b.dataset.leave) setTimeout(() => openEventModal(id), 100);
      })
  );
}

function openEventForm({ event, date, gameId }) {
  const e = event || {};
  const gid = e.gameId || gameId || "";
  const games = [...state.games].sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), "ko"));
  if (!games.length) return toast("먼저 게임 소개 페이지에서 게임을 등록해 주세요");

  const dlg = openModal(`
    <h2>${event ? "모집 공지 수정" : "모집 공지 올리기"}</h2>
    <form id="ev-form" class="form">
      <label class="full">게임 *
        <select class="input" name="gameId" required>
          <option value="">선택하세요</option>
          ${games.map((g) => `<option value="${h(g.id)}" ${g.id === gid ? "selected" : ""}>${h(g.name)} (${players(g)})</option>`).join("")}
        </select></label>
      <p id="ev-hint" class="full small"></p>
      <label>날짜 *<input class="input" type="date" name="date" required min="${ymd()}" value="${h(e.date || date || "")}" /></label>
      <label>시간<input class="input" type="time" name="time" value="${h(e.time || "19:00")}" /></label>
      <label>최소 인원<input class="input" type="number" name="minPlayers" min="1" required value="${h(e.minPlayers)}" /></label>
      <label>최대 인원<input class="input" type="number" name="maxPlayers" min="1" required value="${h(e.maxPlayers)}" /></label>
      <label class="full">장소<input class="input" name="place" placeholder="예) 강남 ○○카페 / 우리집 / 디스코드" value="${h(e.place)}" /></label>
      <label class="full">공지 내용<textarea class="input" name="note" rows="3" placeholder="준비물, 회비, 드레스코드 등">${h(e.note)}</textarea></label>
      <div class="form-actions full">
        <button type="button" class="btn btn-ghost" data-close>취소</button>
        <button class="btn btn-primary">${event ? "수정" : "공지 올리기"}</button>
      </div>
    </form>`);

  const form = dlg.querySelector("#ev-form");
  const hint = dlg.querySelector("#ev-hint");
  const onGame = (fill) => {
    const g = gameById(form.gameId.value);
    if (!g) return (hint.innerHTML = "");
    if (fill) {
      form.minPlayers.value = g.minPlayers || "";
      form.maxPlayers.value = g.maxPlayers || g.minPlayers || "";
    }
    const playedFriends = state.profiles.filter((p) => p.played?.[g.id]);
    const fresh = state.profiles.filter((p) => !p.played?.[g.id]);
    hint.innerHTML = [
      state.me?.played?.[g.id] ? `<span class="warn">⚠ 내가 이미 플레이한 게임이에요.</span>` : "",
      playedFriends.length ? `<span class="muted">이미 해 본 친구: ${playedFriends.map((p) => h(displayName(p))).join(", ")}</span>` : "",
      fresh.length ? `<span class="muted">안 해 본 친구 ${fresh.length}명: ${fresh.map((p) => h(displayName(p))).join(", ")}</span>` : "",
    ]
      .filter(Boolean)
      .join("<br/>");
  };
  form.gameId.onchange = () => onGame(true);
  onGame(!event);

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const g = gameById(f.gameId);
    const minP = Number(f.minPlayers);
    const maxP = Number(f.maxPlayers);
    if (maxP < minP) return toast("최대 인원이 최소 인원보다 작아요");
    const data = {
      gameId: g.id,
      gameName: g.name,
      date: f.date,
      time: f.time,
      minPlayers: minP,
      maxPlayers: maxP,
      place: f.place.trim(),
      note: f.note.trim(),
    };
    try {
      if (event) await store.updateEvent(event.id, data);
      else {
        const name = displayName(state.me) || state.user.name;
        await store.createEvent({ ...data, hostUid: state.user.uid, hostName: name, participants: { [state.user.uid]: name } });
      }
      closeModal();
      toast(event ? "수정했어요" : "모집 공지를 올렸어요 📢");
      const [y, m] = f.date.split("-").map(Number);
      Object.assign(view, { year: y, month: m - 1 });
    } catch (err) {
      showError(err);
    }
  };
}
