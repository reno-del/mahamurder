import { store } from "../store.js";
import { state, displayName, showError } from "../app.js";
import { h, stars, players, prettyDate, ymd, toast } from "../util.js";
import { allGenres, openGameDetail, togglePlayed, toggleLiked, setRating, cleanName, cover } from "./games.js";

const LENGTHS = ["~2시간", "2~4시간", "4시간 이상", "상관없음"];
const tab = { value: "all" };

export function renderMypage(root) {
  if (!state.user) {
    root.dataset.page = "";
    root.innerHTML = `
      <section class="empty big">
        <h2>🕵️ 탐정 수첩</h2>
        <p class="muted">로그인하면 플레이한 게임과 취향을 기록할 수 있어요.</p>
        <button class="btn btn-primary" id="login2">로그인</button>
      </section>`;
    root.querySelector("#login2").onclick = () => store.login().catch(showError);
    return;
  }

  if (root.dataset.page !== `mypage:${state.user.uid}`) {
    root.dataset.page = `mypage:${state.user.uid}`;
    root.innerHTML = `<div id="mp" class="stack">
      <section class="card profile">
        <div class="profile-head">
          ${state.user.photo ? `<img class="avatar lg" src="${h(state.user.photo)}" alt="" referrerpolicy="no-referrer" />` : `<div class="avatar lg avatar-blank">🕵️</div>`}
          <form id="profile-form" class="profile-form">
            <label>닉네임<input class="input" name="nickname" maxlength="20" /></label>
            <label>한마디<input class="input" name="bio" maxlength="60" placeholder="예) 범인 역할 전문입니다" /></label>
            <button class="btn btn-sm">저장</button>
          </form>
        </div>
        <div id="stats" class="stats"></div>
      </section>

      <section class="card">
        <h2 class="section-title">선호하는 장르</h2>
        <div id="pref-genres" class="chips"></div>
        <h2 class="section-title">선호하는 플레이 시간</h2>
        <div id="pref-length" class="chips"></div>
      </section>

      <section id="recommend"></section>

      <section class="card">
        <div class="section-head">
          <h2 class="section-title">게임 기록</h2>
          <div class="seg" id="tabs">
            <button data-tab="all">전체</button>
            <button data-tab="played">플레이함</button>
            <button data-tab="todo">안 해봄</button>
            <button data-tab="liked">선호</button>
          </div>
        </div>
        <div id="checklist"></div>
      </section>

      <section class="card">
        <h2 class="section-title">친구들의 기록</h2>
        <div id="friends"></div>
      </section></div>`;

    root.querySelector("#profile-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        await store.setProfileField(state.user.uid, "nickname", f.nickname.trim());
        await store.setProfileField(state.user.uid, "bio", f.bio.trim());
        toast("프로필을 저장했어요");
      } catch (err) {
        showError(err);
      }
    };

    root.querySelector("#mp").addEventListener("click", async (e) => {
      const t = e.target.closest("button, [data-open]");
      if (!t) return;
      const uid = state.user.uid;
      const me = state.me || {};
      if (t.dataset.genre !== undefined) {
        const g = t.dataset.genre;
        const cur = me.prefGenres || [];
        await store.setProfileField(uid, "prefGenres", cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]).catch(showError);
      } else if (t.dataset.length !== undefined) {
        await store.setProfileField(uid, "prefLength", me.prefLength === t.dataset.length ? null : t.dataset.length).catch(showError);
      } else if (t.dataset.tab) {
        tab.value = t.dataset.tab;
        renderMypage(root);
      } else if (t.dataset.played) {
        await togglePlayed(t.dataset.played);
      } else if (t.dataset.liked) {
        await toggleLiked(t.dataset.liked);
      } else if (t.dataset.rate) {
        const [gid, n] = t.dataset.rate.split(":");
        await setRating(gid, Number(n));
      } else if (t.dataset.open) {
        openGameDetail(t.dataset.open);
      }
    });
  }

  const me = state.me || {};
  const form = root.querySelector("#profile-form");
  if (!form.contains(document.activeElement)) {
    form.nickname.value = me.nickname || state.user.name;
    form.bio.value = me.bio || "";
  }

  const playedIds = Object.keys(me.played || {}).filter((id) => state.games.some((g) => g.id === id));
  const likedIds = Object.keys(me.liked || {}).filter((id) => state.games.some((g) => g.id === id));
  const myRatings = playedIds.map((id) => me.played[id].rating).filter((r) => r > 0);
  const today = ymd();
  const myEvents = state.events.filter((e) => e.date >= today && e.participants?.[state.user.uid]);

  root.querySelector("#stats").innerHTML = `
    <div class="stat"><b>${playedIds.length}<small>/${state.games.length}</small></b><span>플레이한 게임</span></div>
    <div class="stat"><b>${likedIds.length}</b><span>선호 게임</span></div>
    <div class="stat"><b>${myRatings.length ? (myRatings.reduce((a, b) => a + b, 0) / myRatings.length).toFixed(1) : "-"}</b><span>내 평균 평점</span></div>
    <div class="stat"><b>${myEvents.length}</b><span>참여 예정</span></div>
    ${
      myEvents.length
        ? `<div class="stat-wide">📅 ${myEvents
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e) => `<a href="#/schedule">${prettyDate(e.date)} ${h(e.gameName)}</a>`)
            .join(" · ")}</div>`
        : ""
    }`;

  const genres = [...new Set([...allGenres(), ...(me.prefGenres || [])])];
  root.querySelector("#pref-genres").innerHTML = genres.length
    ? genres.map((g) => `<button class="chip ${(me.prefGenres || []).includes(g) ? "on" : ""}" data-genre="${h(g)}">${h(g)}</button>`).join("")
    : `<p class="muted small">게임을 등록하면 장르가 여기에 나타나요.</p>`;
  root.querySelector("#pref-length").innerHTML = LENGTHS.map(
    (l) => `<button class="chip ${me.prefLength === l ? "on" : ""}" data-length="${l}">${l}</button>`
  ).join("");

  root.querySelector("#recommend").innerHTML = recommendHtml(me);

  root.querySelectorAll("#tabs [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab.value));
  root.querySelector("#checklist").innerHTML = checklistHtml(me);
  root.querySelector("#friends").innerHTML = friendsHtml();
}

// 안 해 본 게임 중 선호 장르·선호 표시가 많이 겹치는 순서로 추천
function recommendHtml(me) {
  const pref = me.prefGenres || [];
  const list = state.games
    .filter((g) => !me.played?.[g.id])
    .map((g) => ({ g, score: (g.genres || []).filter((x) => pref.includes(x)).length * 2 + (me.liked?.[g.id] ? 3 : 0) + (g.rating || 0) / 5 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!list.length) return "";
  return `
    <h2 class="section-title">🔎 아직 안 해 본 추천 게임</h2>
    <div class="reco">
      ${list
        .map(
          ({ g }) => `
        <div class="reco-item" data-open="${h(g.id)}">
          ${cover(g, "cover-sm")}
          <div><b>${h(cleanName(g.name))}</b><br/><span class="muted small">${players(g)} · ${(g.genres || []).map(h).join(", ")}</span></div>
        </div>`
        )
        .join("")}
    </div>`;
}

function checklistHtml(me) {
  const list = state.games
    .filter((g) => {
      if (tab.value === "played") return me.played?.[g.id];
      if (tab.value === "todo") return !me.played?.[g.id];
      if (tab.value === "liked") return me.liked?.[g.id];
      return true;
    })
    .sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), "ko"));
  if (!list.length) return `<p class="muted small">해당하는 게임이 없어요.</p>`;
  return `
    <ul class="checklist">
      ${list
        .map((g) => {
          const p = me.played?.[g.id];
          return `
        <li>
          <button class="check ${p ? "on" : ""}" data-played="${h(g.id)}" aria-label="플레이 여부">${p ? "✔" : ""}</button>
          <button class="link-btn" data-open="${h(g.id)}">${h(g.name)}</button>
          <span class="rate">${
            p
              ? [1, 2, 3, 4, 5].map((n) => `<button class="star-btn sm ${p.rating >= n ? "on" : ""}" data-rate="${h(g.id)}:${n}" aria-label="${n}점">★</button>`).join("")
              : `<span class="muted small">안 해봄</span>`
          }</span>
          <button class="heart ${me.liked?.[g.id] ? "on" : ""}" data-liked="${h(g.id)}" aria-label="선호">${me.liked?.[g.id] ? "♥" : "♡"}</button>
        </li>`;
        })
        .join("")}
    </ul>`;
}

function friendsHtml() {
  const others = state.profiles.filter((p) => p.id !== state.user.uid);
  if (!others.length) return `<p class="muted small">아직 다른 친구가 없어요. 사이트 주소를 공유해 보세요!</p>`;
  return `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>이름</th><th>플레이</th><th>선호 장르</th><th>한마디</th></tr></thead>
      <tbody>
      ${others
        .map((p) => {
          const n = Object.keys(p.played || {}).filter((id) => state.games.some((g) => g.id === id)).length;
          return `<tr><td>${h(displayName(p))}</td><td>${n}개</td><td>${(p.prefGenres || []).map(h).join(", ") || "-"}</td><td class="muted">${h(p.bio || "")}</td></tr>`;
        })
        .join("")}
      </tbody></table></div>`;
}
