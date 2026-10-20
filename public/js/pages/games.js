import { store } from "../store.js";
import { state, displayName, requireLogin, showError } from "../app.js";
import { h, won, stars, players, playTime, prettyDate, ymd, openModal, closeModal, toast } from "../util.js";

const filter = { q: "", genre: "", size: "", sort: "rating" };

export const gameById = (id) => state.games.find((g) => g.id === id);
export const cleanName = (name) => String(name || "").replace(/^예시\)\s*/, "");
export const allGenres = () => [...new Set(state.games.flatMap((g) => g.genres || []))].sort();
export const playedBy = (gid) => state.profiles.filter((p) => p.played?.[gid]);

// 친구들이 남긴 평점 평균
export function friendRating(gid) {
  const rs = playedBy(gid).map((p) => p.played[gid].rating).filter((r) => r > 0);
  return rs.length ? { avg: rs.reduce((a, b) => a + b, 0) / rs.length, count: rs.length } : null;
}

export function cover(g, cls = "") {
  if (g.imageUrl) return `<div class="cover ${cls}"><img src="${h(g.imageUrl)}" alt="" loading="lazy" /></div>`;
  const hue = [...(g.name || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `<div class="cover cover-blank ${cls}" style="--hue:${hue}"><span>${h(cleanName(g.name).slice(0, 1))}</span></div>`;
}

export async function togglePlayed(gid) {
  if (!requireLogin()) return;
  const on = state.me?.played?.[gid];
  await store
    .setProfileField(state.user.uid, `played.${gid}`, on ? null : { rating: 0, date: ymd() })
    .catch(showError);
}
export async function toggleLiked(gid) {
  if (!requireLogin()) return;
  await store.setProfileField(state.user.uid, `liked.${gid}`, state.me?.liked?.[gid] ? null : true).catch(showError);
}
export async function setRating(gid, rating) {
  if (!requireLogin()) return;
  const cur = state.me?.played?.[gid] || { date: ymd() };
  await store.setProfileField(state.user.uid, `played.${gid}`, { ...cur, rating }).catch(showError);
}

function filtered() {
  const q = filter.q.trim().toLowerCase();
  const size = Number(filter.size);
  const list = state.games.filter(
    (g) =>
      (!q || [g.name, g.publisher, g.description, ...(g.genres || [])].join(" ").toLowerCase().includes(q)) &&
      (!filter.genre || (g.genres || []).includes(filter.genre)) &&
      (!size || ((g.minPlayers || 0) <= size && size <= (g.maxPlayers || g.minPlayers || 99)))
  );
  const by = {
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    release: (a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")),
    priceAsc: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
    name: (a, b) => cleanName(a.name).localeCompare(cleanName(b.name), "ko"),
    popular: (a, b) => playedBy(b.id).length - playedBy(a.id).length,
  };
  return list.sort(by[filter.sort]);
}

function cardHtml(g) {
  const me = state.me;
  const fr = friendRating(g.id);
  const n = playedBy(g.id).length;
  return `
  <article class="card game-card" data-open="${h(g.id)}" tabindex="0">
    ${cover(g)}
    <div class="game-body">
      <div class="badges">
        ${me?.played?.[g.id] ? `<span class="badge badge-done">플레이함</span>` : ""}
        ${me?.liked?.[g.id] ? `<span class="badge badge-like">♥ 선호</span>` : ""}
      </div>
      <h3 class="game-title">${h(g.name)}</h3>
      <p class="muted small">${h(g.publisher || "")}</p>
      <div class="rating"><span class="stars">${stars(g.rating)}</span> <b>${g.rating ? Number(g.rating).toFixed(1) : "-"}</b>
        ${fr ? `<span class="muted small">· 친구 평균 ${fr.avg.toFixed(1)}</span>` : ""}</div>
      <dl class="facts">
        <div><dt>가격</dt><dd>${won(g.price)}</dd></div>
        <div><dt>출시</dt><dd>${h(g.releaseDate || "-")}</dd></div>
        <div><dt>인원</dt><dd>${players(g)}</dd></div>
        <div><dt>시간</dt><dd>${playTime(g.playTime) || "-"}</dd></div>
      </dl>
      <div class="tags">${(g.genres || []).map((t) => `<span class="tag">${h(t)}</span>`).join("")}</div>
      ${n ? `<p class="muted small">👥 친구 ${n}명 플레이</p>` : ""}
    </div>
  </article>`;
}

function upcomingHtml() {
  if (!state.user) return "";
  const today = ymd();
  const list = state.events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 3);
  if (!list.length) return "";
  return `
  <section class="notice-strip">
    <h2 class="strip-title">📢 모집 중인 일정</h2>
    <div class="strip-list">
      ${list
        .map((e) => {
          const cnt = Object.keys(e.participants || {}).length;
          return `<a class="strip-item" href="#/schedule">
            <b>${prettyDate(e.date)} ${h(e.time || "")}</b>
            <span>${h(e.gameName)}</span>
            <span class="muted small">${cnt}/${e.maxPlayers || "?"}명</span></a>`;
        })
        .join("")}
    </div>
  </section>`;
}

export function renderGames(root) {
  if (root.dataset.page !== "games") {
    root.dataset.page = "games";
    root.innerHTML = `
      <section class="hero">
        <h1>오늘 밤, 누가 범인일까?</h1>
        <p class="muted">우리끼리 해 본 / 하고 싶은 머더미스터리 게임 모음</p>
      </section>
      <div id="upcoming"></div>
      <div class="toolbar">
        <input id="f-q" class="input" type="search" placeholder="게임 이름, 장르, 제작사 검색" />
        <select id="f-genre" class="input"></select>
        <select id="f-size" class="input">
          <option value="">인원 전체</option>
          ${[3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}">${n}명이서</option>`).join("")}
        </select>
        <select id="f-sort" class="input">
          <option value="rating">평점순</option>
          <option value="release">최신 출시순</option>
          <option value="priceAsc">낮은 가격순</option>
          <option value="popular">친구 플레이순</option>
          <option value="name">이름순</option>
        </select>
        <button class="btn btn-primary" id="add-game">+ 게임 추가</button>
      </div>
      <div id="game-grid" class="grid"></div>`;

    const bind = (id, key, ev = "change") =>
      root.querySelector(id).addEventListener(ev, (e) => {
        filter[key] = e.target.value;
        updateGrid(root);
      });
    bind("#f-q", "q", "input");
    bind("#f-genre", "genre");
    bind("#f-size", "size");
    bind("#f-sort", "sort");
    root.querySelector("#f-q").value = filter.q;
    root.querySelector("#f-size").value = filter.size;
    root.querySelector("#f-sort").value = filter.sort;
    root.querySelector("#add-game").onclick = () => requireLogin() && openGameForm();

    const grid = root.querySelector("#game-grid");
    grid.addEventListener("click", (e) => {
      const card = e.target.closest("[data-open]");
      if (card) openGameDetail(card.dataset.open);
      if (e.target.closest("#seed")) requireLogin() && store.seedGames().catch(showError);
    });
    grid.addEventListener("keydown", (e) => {
      const card = e.target.closest("[data-open]");
      if (card && e.key === "Enter") openGameDetail(card.dataset.open);
    });
  }

  const genreSel = root.querySelector("#f-genre");
  genreSel.innerHTML =
    `<option value="">장르 전체</option>` +
    allGenres()
      .map((g) => `<option value="${h(g)}">${h(g)}</option>`)
      .join("");
  genreSel.value = filter.genre;
  root.querySelector("#upcoming").innerHTML = upcomingHtml();
  updateGrid(root);
}

function updateGrid(root) {
  const grid = root.querySelector("#game-grid");
  const list = filtered();
  if (!state.games.length) {
    grid.innerHTML = `<div class="empty">아직 등록된 게임이 없어요.<br/><button class="btn" id="seed">예시 게임 불러오기</button></div>`;
  } else if (!list.length) {
    grid.innerHTML = `<div class="empty">조건에 맞는 게임이 없어요.</div>`;
  } else {
    grid.innerHTML = list.map(cardHtml).join("");
  }
}

// ---------- 상세 모달 ----------
export function openGameDetail(gid) {
  const g = gameById(gid);
  if (!g) return;
  const me = state.me;
  const played = me?.played?.[gid];
  const fr = friendRating(gid);
  const friends = playedBy(gid);

  const dlg = openModal(`
    <div class="detail">
      ${cover(g, "cover-lg")}
      <div>
        <h2>${h(g.name)}</h2>
        <p class="muted">${h(g.publisher || "")}</p>
        <div class="rating"><span class="stars">${stars(g.rating)}</span> <b>${g.rating ? Number(g.rating).toFixed(1) : "-"}</b>
          <span class="muted small">외부 평가</span></div>
        ${fr ? `<div class="rating"><span class="stars">${stars(fr.avg)}</span> <b>${fr.avg.toFixed(1)}</b> <span class="muted small">친구 ${fr.count}명 평균</span></div>` : ""}
        <dl class="facts facts-wide">
          <div><dt>가격</dt><dd>${won(g.price)}</dd></div>
          <div><dt>출시일</dt><dd>${h(g.releaseDate || "-")}</dd></div>
          <div><dt>인원</dt><dd>${players(g)}</dd></div>
          <div><dt>플레이 시간</dt><dd>${playTime(g.playTime) || "-"}</dd></div>
          <div><dt>난이도</dt><dd>${h(g.difficulty || "-")}</dd></div>
        </dl>
        <div class="tags">${(g.genres || []).map((t) => `<span class="tag">${h(t)}</span>`).join("")}</div>
      </div>
    </div>
    ${g.description ? `<p class="desc">${h(g.description)}</p>` : ""}
    ${g.link ? `<p><a href="${h(g.link)}" target="_blank" rel="noopener">구매 / 상세 페이지 ↗</a></p>` : ""}

    <div class="detail-actions">
      <button class="btn ${played ? "btn-on" : ""}" data-act="played">${played ? "✔ 플레이함" : "플레이 했어요"}</button>
      <button class="btn ${me?.liked?.[gid] ? "btn-on" : ""}" data-act="liked">${me?.liked?.[gid] ? "♥ 선호" : "♡ 하고 싶어요"}</button>
      <button class="btn btn-primary" data-act="schedule">📅 이 게임으로 모집하기</button>
    </div>
    ${
      played
        ? `<div class="my-rating">내 평점 ${[1, 2, 3, 4, 5]
            .map((n) => `<button class="star-btn ${played.rating >= n ? "on" : ""}" data-rate="${n}" aria-label="${n}점">★</button>`)
            .join("")}</div>`
        : ""
    }
    <h3 class="section-title">이 게임을 해 본 친구 (${friends.length})</h3>
    ${
      friends.length
        ? `<ul class="people">${friends
            .map((p) => `<li>${h(displayName(p))}${p.played[gid].rating ? ` <span class="stars small">${stars(p.played[gid].rating)}</span>` : ""}</li>`)
            .join("")}</ul>`
        : `<p class="muted small">${state.user ? "아직 아무도 안 해 봤어요 — 모두 처음이라 모집하기 좋아요!" : "로그인하면 친구들의 기록을 볼 수 있어요."}</p>`
    }
    <div class="detail-footer">
      <button class="btn btn-ghost btn-sm" data-act="edit">정보 수정</button>
      <button class="btn btn-ghost btn-sm danger" data-act="delete">삭제</button>
    </div>`);

  dlg.querySelectorAll("[data-act]").forEach(
    (b) =>
      (b.onclick = async () => {
        const act = b.dataset.act;
        if (act === "played") await togglePlayed(gid);
        if (act === "liked") await toggleLiked(gid);
        if (act === "schedule") {
          closeModal();
          location.hash = `#/schedule/new/${gid}`;
          return;
        }
        if (act === "edit") return requireLogin() && openGameForm(g);
        if (act === "delete") {
          if (!requireLogin() || !confirm(`'${g.name}'을(를) 삭제할까요?`)) return;
          await store.deleteGame(gid).catch(showError);
          closeModal();
          return;
        }
        openGameDetail(gid);
      })
  );
  dlg.querySelectorAll("[data-rate]").forEach(
    (b) =>
      (b.onclick = async () => {
        await setRating(gid, Number(b.dataset.rate));
        openGameDetail(gid);
      })
  );
}

// ---------- 추가 / 수정 폼 ----------
function openGameForm(g = {}) {
  const dlg = openModal(`
    <h2>${g.id ? "게임 정보 수정" : "새 게임 추가"}</h2>
    <form id="game-form" class="form">
      <label class="full">게임 이름 *<input class="input" name="name" required value="${h(g.name)}" /></label>
      <label>제작사 / 출판사<input class="input" name="publisher" value="${h(g.publisher)}" /></label>
      <label>가격 (원)<input class="input" name="price" type="number" min="0" step="100" value="${h(g.price)}" /></label>
      <label>출시일<input class="input" name="releaseDate" type="date" value="${h(g.releaseDate)}" /></label>
      <label>평가 (0~5)<input class="input" name="rating" type="number" min="0" max="5" step="0.1" value="${h(g.rating)}" /></label>
      <label>최소 인원<input class="input" name="minPlayers" type="number" min="1" value="${h(g.minPlayers)}" /></label>
      <label>최대 인원<input class="input" name="maxPlayers" type="number" min="1" value="${h(g.maxPlayers)}" /></label>
      <label>플레이 시간 (분)<input class="input" name="playTime" type="number" min="0" step="10" value="${h(g.playTime)}" /></label>
      <label>난이도
        <select class="input" name="difficulty">
          ${["", "쉬움", "보통", "어려움"].map((d) => `<option ${g.difficulty === d ? "selected" : ""}>${d}</option>`).join("")}
        </select></label>
      <label class="full">장르 (쉼표로 구분)<input class="input" name="genres" placeholder="클로즈드 서클, 추리, 감성" value="${h((g.genres || []).join(", "))}" /></label>
      <label class="full">이미지 URL<input class="input" name="imageUrl" type="url" value="${h(g.imageUrl)}" /></label>
      <label class="full">구매/상세 링크<input class="input" name="link" type="url" value="${h(g.link)}" /></label>
      <label class="full">소개 (스포일러 주의!)<textarea class="input" name="description" rows="4">${h(g.description)}</textarea></label>
      <div class="form-actions full">
        <button type="button" class="btn btn-ghost" data-close>취소</button>
        <button class="btn btn-primary">저장</button>
      </div>
    </form>`);

  dlg.querySelector("#game-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const num = (v) => (v === "" ? null : Number(v));
    const data = {
      id: g.id,
      name: f.name.trim(),
      publisher: f.publisher.trim(),
      price: num(f.price),
      releaseDate: f.releaseDate,
      rating: num(f.rating),
      minPlayers: num(f.minPlayers),
      maxPlayers: num(f.maxPlayers) ?? num(f.minPlayers),
      playTime: num(f.playTime),
      difficulty: f.difficulty,
      genres: f.genres.split(",").map((s) => s.trim()).filter(Boolean),
      imageUrl: f.imageUrl.trim(),
      link: f.link.trim(),
      description: f.description.trim(),
    };
    try {
      await store.saveGame(data);
      closeModal();
      toast("저장했어요");
    } catch (err) {
      showError(err);
    }
  };
}
