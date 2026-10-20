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

export async function create(config: FirebaseConfig): Promise<Store> {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  return {
    mode: "firebase",

    // ---------- 인증 ----------
    onUser(cb) {
      return onAuthStateChanged(auth, async (u) => {
        if (!u) return cb(null);
        const user: AppUser = { uid: u.uid, name: u.displayName || "익명", photo: u.photoURL || "" };
        // 프로필 문서가 없으면 만들어 둔다 (이후 updateDoc 사용 가능)
        await setDoc(
          doc(db, "users", u.uid),
          { googleName: user.name, photo: user.photo, lastLogin: serverTimestamp() },
          { merge: true }
        );
        cb(user);
      });
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
      SEED_GAMES.forEach((g) => batch.set(doc(collection(db, "games")), { ...g, createdAt: serverTimestamp() }));
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
}
