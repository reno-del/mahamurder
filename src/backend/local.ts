// Firebase 설정 전 화면을 미리 보기 위한 데모 저장소 (이 브라우저에만 저장됨)
import { SEED_GAMES } from "../data/seedGames";
import type { AppUser, Store } from "../types";

type Doc = Record<string, unknown>;
type Collection = Record<string, Doc>;
type ListKey = "games" | "users" | "guests" | "events";
type Key = ListKey | "me";

const KEY: Record<Key, string> = { games: "mm_games", users: "mm_users", guests: "mm_guests", events: "mm_events", me: "mm_me" };
const listeners: Record<Key, ((v: never) => void)[]> = { games: [], users: [], guests: [], events: [], me: [] };

function read<T>(key: Key, fallback: T): T {
  try {
    const v = localStorage.getItem(KEY[key]);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: Key, value: unknown) {
  try {
    localStorage.setItem(KEY[key], JSON.stringify(value));
  } catch {
    /* 저장 불가(사생활 보호 모드 등) */
  }
  emit(key);
}
function emit(key: Key) {
  const v =
    key === "me" ? read<AppUser | null>("me", null) : Object.entries(read<Collection>(key, {})).map(([id, d]) => ({ id, ...d }));
  listeners[key].forEach((cb) => cb(v as never));
}
function watch<T>(key: Key, cb: (v: T) => void) {
  listeners[key].push(cb as (v: never) => void);
  setTimeout(() => emit(key));
  return () => {
    listeners[key] = listeners[key].filter((f) => f !== cb);
  };
}
const newId = () => Math.random().toString(36).slice(2, 12);
const now = () => new Date().toISOString();

function setPath(obj: Doc, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = obj;
  keys.slice(0, -1).forEach((k) => (cur = (cur[k] ??= {}) as Doc));
  const last = keys[keys.length - 1];
  if (value === null) delete cur[last];
  else cur[last] = value;
}

function update(key: ListKey, id: string, fn: (d: Doc) => void) {
  const all = read<Collection>(key, {});
  if (!all[id]) return;
  fn(all[id]);
  write(key, all);
}

export async function create(): Promise<Store> {
  if (!read<Collection | null>("games", null)) {
    const games: Collection = {};
    SEED_GAMES.forEach((g) => (games[newId()] = { ...g, createdAt: now() }));
    write("games", games);
  }

  const store: Store = {
    mode: "local",

    // 데모에서는 로그인하면 회원이다. 비회원 화면은 mm_me에 member: false를 넣어 확인할 수 있다 (초대 코드는 "demo")
    onUser: (cb) => watch<AppUser | null>("me", (u) => cb(u && { ...u, member: u.member !== false })),
    async join(code) {
      const me = read<AppUser | null>("me", null);
      if (!me) return store.login();
      if (code !== "demo") throw new Error("초대 링크가 올바르지 않거나 만료됐어요");
      write("me", { ...me, member: true });
    },
    getInviteCode: async () => "demo",
    async login() {
      const name = prompt("데모 모드: 사용할 닉네임을 입력하세요", "탐정");
      if (!name) return;
      const users = read<Collection>("users", {});
      const found = Object.entries(users).find(([, u]) => u.googleName === name);
      const uid = found ? found[0] : newId();
      users[uid] = { ...(users[uid] || {}), googleName: name, photo: "" };
      write("users", users);
      write("me", { uid, name, photo: "", member: true });
    },
    async logout() {
      write("me", null);
    },

    watchGames: (cb) => watch("games", cb),
    async saveGame({ id, ...data }) {
      const all = read<Collection>("games", {});
      const gid = id || newId();
      all[gid] = { ...(all[gid] || { createdAt: now() }), ...data, updatedAt: now() };
      write("games", all);
    },
    async deleteGame(id) {
      const all = read<Collection>("games", {});
      delete all[id];
      write("games", all);
    },
    async seedGames() {
      const all = read<Collection>("games", {});
      SEED_GAMES.forEach((g) => (all[newId()] = { ...g, createdAt: now() }));
      write("games", all);
    },

    async rentGame(id, ownerUid, rental) {
      update("games", id, (g) => setPath(g, `rentals.${ownerUid}`, rental));
    },
    async returnGame(id, ownerUid) {
      update("games", id, (g) => setPath(g, `rentals.${ownerUid}`, null));
    },

    watchProfiles: (cb) => watch("users", cb),
    async setProfileField(uid, path, value) {
      update("users", uid, (u) => setPath(u, path, value));
    },

    watchGuests: (cb) => watch("guests", cb),
    async createGuest(name, createdBy) {
      const all = read<Collection>("guests", {});
      all[newId()] = { name, createdBy, createdAt: now() };
      write("guests", all);
    },
    async setGuestField(id, path, value) {
      update("guests", id, (g) => setPath(g, path, value));
    },
    async deleteGuest(id) {
      const all = read<Collection>("guests", {});
      delete all[id];
      write("guests", all);
    },

    watchEvents: (cb) => watch("events", cb),
    async createEvent(ev) {
      const all = read<Collection>("events", {});
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
      const all = read<Collection>("events", {});
      delete all[id];
      write("events", all);
    },
  };
  return store;
}
