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
  type QuerySnapshot,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { SEED_GAMES } from "../data/seedGames";
import type { FirebaseConfig } from "../config";
import type { AppUser, Game, GameEvent, Guest, Profile, Store } from "../types";

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

export async function create(config: FirebaseConfig): Promise<Store> {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let emitUser: ((user: AppUser | null) => void) | undefined;

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
        cb(await checkMember(user));
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
    logout: () => signOut(auth),

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

    rentGame: (id, ownerUid, rental) => updateDoc(doc(db, "games", id), { [`rentals.${ownerUid}`]: rental }),
    returnGame: (id, ownerUid) => updateDoc(doc(db, "games", id), { [`rentals.${ownerUid}`]: deleteField() }),

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
  };
  return store;
}
