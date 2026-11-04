import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  writeBatch,
  query,
  orderBy,
  limit,
  type QuerySnapshot,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { SEED_GAMES } from "../data/seedGames";
import type { FirebaseConfig } from "../config";
import { pushSupport } from "../lib/push";
import type { AppUser, Game, GameEvent, Guest, Notice, Profile, Store } from "../types";

const toList = <T>(snap: QuerySnapshot) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);

// 초대 링크로 들어온 뒤 로그인(팝업·리다이렉트·카톡에서 외부 브라우저로 이동)하는 동안 코드를 기억해 둔다
const INVITE_KEY = "mm_invite";
function loadPendingInvite() {
  try {
    return localStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}
function savePendingInvite(code: string | null) {
  try {
    if (code) localStorage.setItem(INVITE_KEY, code);
    else localStorage.removeItem(INVITE_KEY);
  } catch {
    /* 저장 불가(사생활 보호 모드 등) */
  }
}

// 이 기기에서 알림을 켰을 때 받은 FCM 토큰. 끌 때 pushTokens 문서를 지우는 데 쓴다
const PUSH_KEY = "mm_push_token";
function loadPushToken() {
  try {
    return localStorage.getItem(PUSH_KEY);
  } catch {
    return null;
  }
}
function savePushToken(token: string | null) {
  try {
    if (token) localStorage.setItem(PUSH_KEY, token);
    else localStorage.removeItem(PUSH_KEY);
  } catch {
    /* 저장 불가(사생활 보호 모드 등) */
  }
}

export async function create(config: FirebaseConfig): Promise<Store> {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let emitUser: ((user: AppUser | null) => void) | undefined;

  // 알림은 public/sw.js가 받아 보여 준다. 서비스 워커는 배포 빌드에서만 등록되므로(main.tsx) 개발 서버에서는 못 쓴다.
  // firebase/messaging은 알림을 켤 때만 불러온다
  async function fcmToken() {
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!import.meta.env.PROD || !(await isSupported())) throw new Error("이 브라우저에서는 알림을 받을 수 없어요");
    return getToken(getMessaging(app), { serviceWorkerRegistration: await navigator.serviceWorker.ready });
  }
  async function saveToken(uid: string) {
    const token = await fcmToken();
    const old = loadPushToken();
    await setDoc(doc(db, "pushTokens", token), { uid, updatedAt: serverTimestamp() });
    savePushToken(token);
    if (old && old !== token) await deleteDoc(doc(db, "pushTokens", old)).catch(() => {});
  }

  // users 문서가 있으면 회원이다. 없으면 기억해 둔 초대 코드로 만들어 본다 (규칙이 config/invite의 코드와 비교)
  async function checkMember(user: AppUser): Promise<AppUser> {
    const ref = doc(db, "users", user.uid);
    const profile = { googleName: user.name, photo: user.photo, lastLogin: serverTimestamp() };
    if ((await getDoc(ref)).exists()) {
      await updateDoc(ref, profile);
      return { ...user, member: true };
    }
    const code = loadPendingInvite();
    if (!code) return user;
    savePendingInvite(null);
    try {
      await setDoc(ref, { ...profile, inviteCode: code });
      return { ...user, member: true };
    } catch {
      return user;
    }
  }

  const store: Store = {
    mode: "firebase",

    // ---------- 인증 ----------
    onUser(cb) {
      emitUser = cb;
      return onAuthStateChanged(auth, async (u) => {
        if (!u) return cb(null);
        const user: AppUser = { uid: u.uid, name: u.displayName || "익명", photo: u.photoURL || "", member: false };
        const checked = await checkMember(user);
        cb(checked);
        // 토큰은 바뀔 수 있고, 보내기 스크립트가 못 쓰게 된 토큰을 지웠을 수도 있어 접속할 때마다 다시 저장한다
        if (checked.member && loadPushToken() && !pushSupport() && Notification.permission === "granted")
          saveToken(u.uid).catch(() => {});
      });
    },
    async join(code) {
      savePendingInvite(code);
      const u = auth.currentUser;
      // 로그인 전이면 로그인 후 onUser에서 기억해 둔 코드로 가입한다
      if (!u) return store.login();
      const user = await checkMember({ uid: u.uid, name: u.displayName || "익명", photo: u.photoURL || "", member: false });
      emitUser?.(user);
      if (!user.member) throw new Error("초대 링크가 올바르지 않거나 만료됐어요");
    },
    async getInviteCode() {
      const snap = await getDoc(doc(db, "config", "invite"));
      return (snap.data()?.code as string | undefined) || null;
    },
    async login() {
      // 카카오톡 인앱 브라우저는 Google 로그인을 막으므로 외부 브라우저로 다시 연다
      if (/KAKAOTALK/i.test(navigator.userAgent)) {
        location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
        return;
      }
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        const code = e instanceof FirebaseError ? e.code : "";
        if (code === "auth/popup-blocked") return signInWithRedirect(auth, provider);
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
        throw e;
      }
    },
    async logout() {
      // 로그아웃한 기기로 알림이 가지 않게 먼저 끈다 (문서 삭제는 로그인 상태여야 규칙을 통과)
      await store.disablePush().catch(() => {});
      await signOut(auth);
    },

    // ---------- 게임 ----------
    watchGames(cb) {
      return onSnapshot(collection(db, "games"), (s) => cb(toList<Game>(s)));
    },
    async saveGame({ id, ...data }) {
      const withTime = { ...data, updatedAt: serverTimestamp() };
      if (id) await setDoc(doc(db, "games", id), withTime, { merge: true });
      else await addDoc(collection(db, "games"), { ...withTime, createdAt: serverTimestamp() });
    },
    deleteGame: (id) => deleteDoc(doc(db, "games", id)),
    async seedGames() {
      const batch = writeBatch(db);
      const createdBy = auth.currentUser?.uid;
      SEED_GAMES.forEach((g) => batch.set(doc(collection(db, "games")), { ...g, createdBy, createdAt: serverTimestamp() }));
      await batch.commit();
    },
    // 배치 하나에 500개까지라 400개씩 나눠 커밋한다. 중간에 실패하면 앞 배치는 이미 들어가 있으므로 몇 개까지 들어갔는지 알린다
    async importGames(games) {
      const CHUNK = 400;
      for (let i = 0; i < games.length; i += CHUNK) {
        const batch = writeBatch(db);
        games.slice(i, i + CHUNK).forEach(({ id: _id, ...g }) =>
          batch.set(doc(collection(db, "games")), { ...g, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
        );
        try {
          await batch.commit();
        } catch (err) {
          if (i === 0) throw err;
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`${games.length}개 중 ${i}개만 등록하고 실패했어요: ${msg}`);
        }
      }
    },

    rentGame: (id, ownerUid, rental) => updateDoc(doc(db, "games", id), { [`rentals.${ownerUid}`]: rental }),
    returnGame: (id, ownerUid) => updateDoc(doc(db, "games", id), { [`rentals.${ownerUid}`]: deleteField() }),
    setStorage: (id, ownerUid, place) =>
      updateDoc(doc(db, "games", id), { [`storage.${ownerUid}`]: place === null ? deleteField() : place }),

    // ---------- 프로필 ----------
    watchProfiles(cb) {
      return onSnapshot(collection(db, "users"), (s) => cb(toList<Profile>(s)));
    },
    setProfileField(uid, path, value) {
      return updateDoc(doc(db, "users", uid), { [path]: value === null ? deleteField() : value });
    },

    // ---------- 미등록 친구 ----------
    watchGuests(cb) {
      return onSnapshot(collection(db, "guests"), (s) => cb(toList<Guest>(s)));
    },
    async createGuest(name, createdBy) {
      await addDoc(collection(db, "guests"), { name, createdBy, createdAt: serverTimestamp() });
    },
    setGuestField(id, path, value) {
      return updateDoc(doc(db, "guests", id), { [path]: value === null ? deleteField() : value });
    },
    deleteGuest: (id) => deleteDoc(doc(db, "guests", id)),

    // ---------- 일정 ----------
    watchEvents(cb) {
      return onSnapshot(collection(db, "events"), (s) => cb(toList<GameEvent>(s)));
    },
    async createEvent(ev) {
      await addDoc(collection(db, "events"), { ...ev, createdAt: serverTimestamp() });
    },
    updateEvent: (id, data) => updateDoc(doc(db, "events", id), data),
    joinEvent: (id, user) => updateDoc(doc(db, "events", id), { [`participants.${user.uid}`]: user.name }),
    leaveEvent: (id, uid) => updateDoc(doc(db, "events", id), { [`participants.${uid}`]: deleteField() }),
    deleteEvent: (id) => deleteDoc(doc(db, "events", id)),

    // ---------- 전체 공지 ----------
    watchNotices(cb) {
      const q = query(collection(db, "notices"), orderBy("createdAt", "desc"), limit(20));
      return onSnapshot(q, (s) =>
        cb(
          s.docs.map((d) => {
            // 방금 쓴 공지는 서버 시각이 아직 없으므로 추정값을 쓴다
            const data = d.data({ serverTimestamps: "estimate" });
            return { ...data, id: d.id, createdAt: data.createdAt?.toMillis?.() } as Notice;
          }),
        ),
      );
    },
    async createNotice(n) {
      await addDoc(collection(db, "notices"), { ...n, createdAt: serverTimestamp() });
    },
    deleteNotice: (id) => deleteDoc(doc(db, "notices", id)),

    // ---------- 알림 ----------
    async pushState() {
      const unsupported = pushSupport();
      if (unsupported) return unsupported;
      if (!import.meta.env.PROD) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      return loadPushToken() && Notification.permission === "granted" ? "on" : "off";
    },
    async enablePush(uid) {
      const perm = await Notification.requestPermission();
      if (perm === "denied") throw new Error("알림이 차단돼 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요");
      if (perm !== "granted") throw new Error("알림을 허용해야 받을 수 있어요");
      await saveToken(uid);
    },
    async disablePush() {
      const token = loadPushToken();
      savePushToken(null);
      if (!token) return;
      await deleteDoc(doc(db, "pushTokens", token)).catch(() => {});
      try {
        const { getMessaging, deleteToken } = await import("firebase/messaging");
        await deleteToken(getMessaging(app));
      } catch {
        /* 이미 지워졌거나 지원하지 않는 브라우저 */
      }
    },
  };
  return store;
}
