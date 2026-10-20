// Firebase 설정 전 화면을 미리 보기 위한 데모 저장소 (이 브라우저에만 저장됨)
import { SEED_GAMES } from "./seed-games.js";

const KEY = { games: "mm_games", users: "mm_users", events: "mm_events", me: "mm_me" };
const listeners = { games: [], users: [], events: [], me: [] };

function read(key, fallback) {
  try {
    const v = localStorage.getItem(KEY[key]);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(KEY[key], JSON.stringify(value));
  } catch {}
  emit(key);
}
function emit(key) {
  const v = key === "me" ? read("me", null) : Object.entries(read(key, {})).map(([id, d]) => ({ id, ...d }));
  listeners[key].forEach((cb) => cb(v));
}
function watch(key, cb) {
  listeners[key].push(cb);
  setTimeout(() => emit(key));
  return () => (listeners[key] = listeners[key].filter((f) => f !== cb));
}
const newId = () => Math.random().toString(36).slice(2, 12);
const now = () => new Date().toISOString();

function setPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  keys.slice(0, -1).forEach((k) => (cur = cur[k] ??= {}));
  if (value === null) delete cur[keys.at(-1)];
  else cur[keys.at(-1)] = value;
}

function update(key, id, fn) {
  const all = read(key, {});
  if (!all[id]) return;
  fn(all[id]);
  write(key, all);
}

export async function create() {
  if (!read("games", null)) {
    const games = {};
    SEED_GAMES.forEach((g) => (games[newId()] = { ...g, createdAt: now() }));
    write("games", games);
  }

  return {
    mode: "local",

    onUser: (cb) => watch("me", cb),
    async login() {
      const name = prompt("데모 모드: 사용할 닉네임을 입력하세요", "탐정");
      if (!name) return;
      const users = read("users", {});
      const found = Object.entries(users).find(([, u]) => u.googleName === name);
      const uid = found ? found[0] : newId();
      users[uid] = { ...(users[uid] || {}), googleName: name, photo: "" };
      write("users", users);
      write("me", { uid, name, photo: "" });
    },
    async logout() {
      write("me", null);
    },

    watchGames: (cb) => watch("games", cb),
    async saveGame({ id, ...data }) {
      const all = read("games", {});
      const gid = id || newId();
      all[gid] = { ...(all[gid] || { createdAt: now() }), ...data, updatedAt: now() };
      write("games", all);
    },
    async deleteGame(id) {
      const all = read("games", {});
      delete all[id];
      write("games", all);
    },
    async seedGames() {
      const all = read("games", {});
      SEED_GAMES.forEach((g) => (all[newId()] = { ...g, createdAt: now() }));
      write("games", all);
    },

    watchProfiles: (cb) => watch("users", cb),
    async setProfileField(uid, path, value) {
      update("users", uid, (u) => setPath(u, path, value));
    },

    watchEvents: (cb) => watch("events", cb),
    async createEvent(ev) {
      const all = read("events", {});
      all[newId()] = { ...ev, createdAt: now() };
      write("events", all);
    },
    async updateEvent(id, data) {
      update("events", id, (e) => Object.assign(e, data));
    },
    async joinEvent(id, user) {
      update("events", id, (e) => setPath(e, `participants.${user.uid}`, user.name));
    },
    async leaveEvent(id, uid) {
      update("events", id, (e) => setPath(e, `participants.${uid}`, null));
    },
    async deleteEvent(id) {
      const all = read("events", {});
      delete all[id];
      write("events", all);
    },
  };
}
