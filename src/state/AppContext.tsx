import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { store } from "../store";
import { showError, toast } from "../lib/toast";
import { displayName, ymd } from "../lib/format";
import type { AppUser, Game, GameEvent, Profile } from "../types";

interface AppState {
  user: AppUser | null;
  authReady: boolean;
  games: Game[];
  profiles: Profile[];
  events: GameEvent[];
  /** 로그인한 사용자의 프로필. 로그아웃 상태면 null, 문서가 아직 없으면 { id } */
  me: Profile | null;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);

  // 게임 목록은 누구나 볼 수 있다
  useEffect(() => store.watchGames(setGames), []);

  useEffect(
    () =>
      store.onUser((u) => {
        setUser(u);
        setAuthReady(true);
      }),
    []
  );

  // 프로필·일정은 로그인한 사람만 읽을 수 있다 (firestore.rules)
  const uid = user?.uid;
  useEffect(() => {
    setProfiles([]);
    setEvents([]);
    if (!uid) return;
    const unsubs = [store.watchProfiles(setProfiles), store.watchEvents(setEvents)];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const value = useMemo<AppState>(() => {
    const me = user ? profiles.find((p) => p.id === user.uid) || { id: user.uid } : null;
    return { user, authReady, games, profiles, events, me };
  }, [user, authReady, games, profiles, events]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** 로그인 안 했으면 로그인 창을 띄우고 false */
export function requireLogin(user: AppUser | null) {
  if (user) return true;
  toast("로그인이 필요해요");
  store.login().catch(showError);
  return false;
}

/** 내 이름: 닉네임 > 구글 이름 */
export function useMyName() {
  const { user, me } = useApp();
  return displayName(me) || user?.name || "익명";
}

// ---------- 게임 기록 관련 파생 데이터와 동작 ----------

export function useGameHelpers() {
  const { user, me, games, profiles } = useApp();

  const playedBy = (gid: string) => profiles.filter((p) => p.played?.[gid]);

  return {
    gameById: (id?: string) => games.find((g) => g.id === id),
    playedBy,
    allGenres: () => [...new Set(games.flatMap((g) => g.genres || []))].sort(),

    // 친구들이 남긴 평점 평균
    friendRating(gid: string) {
      const rs = playedBy(gid)
        .map((p) => p.played![gid].rating)
        .filter((r) => r > 0);
      return rs.length ? { avg: rs.reduce((a, b) => a + b, 0) / rs.length, count: rs.length } : null;
    },

    async togglePlayed(gid: string) {
      if (!requireLogin(user)) return;
      const on = me?.played?.[gid];
      await store.setProfileField(user!.uid, `played.${gid}`, on ? null : { rating: 0, date: ymd() }).catch(showError);
    },
    async toggleLiked(gid: string) {
      if (!requireLogin(user)) return;
      await store.setProfileField(user!.uid, `liked.${gid}`, me?.liked?.[gid] ? null : true).catch(showError);
    },
    async setRating(gid: string, rating: number) {
      if (!requireLogin(user)) return;
      const cur = me?.played?.[gid] || { date: ymd() };
      await store.setProfileField(user!.uid, `played.${gid}`, { ...cur, rating }).catch(showError);
    },
  };
}
