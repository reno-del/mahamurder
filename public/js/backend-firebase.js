import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { SEED_GAMES } from "./seed-games.js";

const toList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export async function create(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  return {
    mode: "firebase",

    // ---------- 인증 ----------
    onUser(cb) {
      return onAuthStateChanged(auth, async (u) => {
        if (!u) return cb(null);
        const user = { uid: u.uid, name: u.displayName || "익명", photo: u.photoURL || "" };
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
        if (e.code === "auth/popup-blocked") return signInWithRedirect(auth, provider);
        if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
        throw e;
      }
    },
    logout: () => signOut(auth),

    // ---------- 게임 ----------
    watchGames(cb) {
      return onSnapshot(collection(db, "games"), (s) => cb(toList(s)));
    },
    saveGame({ id, ...data }) {
      data.updatedAt = serverTimestamp();
      if (id) return setDoc(doc(db, "games", id), data, { merge: true });
      return addDoc(collection(db, "games"), { ...data, createdAt: serverTimestamp() });
    },
    deleteGame: (id) => deleteDoc(doc(db, "games", id)),
    async seedGames() {
      const batch = writeBatch(db);
      SEED_GAMES.forEach((g) =>
        batch.set(doc(collection(db, "games")), { ...g, createdAt: serverTimestamp() })
      );
      await batch.commit();
    },

    // ---------- 프로필 ----------
    watchProfiles(cb) {
      return onSnapshot(collection(db, "users"), (s) => cb(toList(s)));
    },
    // path 예: "nickname", "played.<gameId>", "liked.<gameId>" / value가 null이면 필드 삭제
    setProfileField(uid, path, value) {
      return updateDoc(doc(db, "users", uid), { [path]: value === null ? deleteField() : value });
    },

    // ---------- 일정 ----------
    watchEvents(cb) {
      return onSnapshot(collection(db, "events"), (s) => cb(toList(s)));
    },
    createEvent: (ev) => addDoc(collection(db, "events"), { ...ev, createdAt: serverTimestamp() }),
    updateEvent: (id, data) => updateDoc(doc(db, "events", id), data),
    joinEvent: (id, user) => updateDoc(doc(db, "events", id), { [`participants.${user.uid}`]: user.name }),
    leaveEvent: (id, uid) => updateDoc(doc(db, "events", id), { [`participants.${uid}`]: deleteField() }),
    deleteEvent: (id) => deleteDoc(doc(db, "events", id)),
  };
}
