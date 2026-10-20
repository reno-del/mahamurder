import { store } from "./store.js";
import { h, toast } from "./util.js";
import { renderGames } from "./pages/games.js";
import { renderMypage } from "./pages/mypage.js";
import { renderSchedule } from "./pages/schedule.js";

// 앱 전역 상태. 각 페이지는 state를 읽고, 변경은 store를 통해서만 한다.
export const state = {
  user: null,
  authReady: false,
  games: [],
  profiles: [],
  events: [],
  get me() {
    return this.user ? this.profiles.find((p) => p.id === this.user.uid) || {} : null;
  },
};

// 닉네임(마이페이지에서 설정) > 구글 이름
export const displayName = (p) => (p && (p.nickname || p.googleName)) || "익명";

export function requireLogin() {
  if (state.user) return true;
  toast("로그인이 필요해요");
  store.login().catch(showError);
  return false;
}

export function showError(e) {
  console.error(e);
  const msg = {
    "permission-denied": "권한이 없어요",
    "auth/configuration-not-found": "Firebase 콘솔에서 Google 로그인이 아직 설정되지 않았어요",
    "auth/unauthorized-domain": "이 도메인은 Firebase 승인된 도메인에 없어요",
  }[e?.code];
  toast(msg || "오류가 발생했어요: " + (e?.message || e));
}

const ROUTES = { games: renderGames, mypage: renderMypage, schedule: renderSchedule };

export function render() {
  const [, page = "games", ...params] = location.hash.split("/");
  const route = ROUTES[page] ? page : "games";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === route));
  ROUTES[route](document.getElementById("view"), params);
}

function renderAuth() {
  const el = document.getElementById("auth");
  if (!state.authReady) return (el.innerHTML = "");
  if (!state.user) {
    el.innerHTML = `<button class="btn btn-primary btn-sm" id="login">${store.mode === "local" ? "데모 로그인" : "Google 로그인"}</button>`;
    el.querySelector("#login").onclick = () => store.login().catch(showError);
    return;
  }
  const name = displayName(state.me) || state.user.name;
  el.innerHTML = `
    ${state.user.photo ? `<img class="avatar" src="${h(state.user.photo)}" alt="" referrerpolicy="no-referrer" />` : ""}
    <span class="auth-name">${h(name)}</span>
    <button class="btn btn-ghost btn-sm" id="logout">로그아웃</button>`;
  el.querySelector("#logout").onclick = () => store.logout();
}

// 모달이 열려 있을 때는 페이지만 다시 그리고 모달 안의 입력값은 건드리지 않는다.
let queued = false;
function refresh() {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    renderAuth();
    render();
  });
}

document.getElementById("demo-banner").hidden = store.mode !== "local";
window.addEventListener("hashchange", () => {
  window.scrollTo(0, 0);
  render();
});

// 게임 목록은 누구나 볼 수 있고, 프로필·일정은 로그인한 사람만 읽을 수 있다 (firestore.rules)
store.watchGames((g) => ((state.games = g), refresh()));

let unsubs = [];
store.onUser((user) => {
  state.user = user;
  state.authReady = true;
  unsubs.forEach((u) => u());
  unsubs = [];
  state.profiles = [];
  state.events = [];
  if (user) {
    unsubs.push(
      store.watchProfiles((p) => ((state.profiles = p), refresh())),
      store.watchEvents((e) => ((state.events = e), refresh()))
    );
  }
  refresh();
});
