import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { store } from "../store";
import { showError, toast } from "../lib/toast";
import { displayName, ymd } from "../lib/format";
import type { AppUser, Game, GameEvent, Guest, Profile, Rental } from "../types";

/** 게임 보유자: 가입한 친구(프로필) 또는 미등록 친구(guests) */
export interface Owner {
  id: string;
  name: string;
  guest?: boolean;
}

/** 한 사람이 가진 게임 한 벌과 그 대여 상태 */
export interface Copy {
  owner: Owner;
  rental?: Rental;
}

interface AppState {
  /** 로그인한 회원. 로그인했어도 초대받지 않았으면 null이고 outsider에 들어간다 */
  user: AppUser | null;
  /** 로그인은 했지만 회원이 아닌 사람 (초대 링크 안내용) */
  outsider: AppUser | null;
  authReady: boolean;
  games: Game[];
  profiles: Profile[];
  guests: Guest[];
  events: GameEvent[];
  /** 일정 목록을 한 번이라도 받았는지 (공유 링크의 일정이 지워졌는지 가릴 때 씀) */
  eventsReady: boolean;
  /** 로그인한 사용자의 프로필. 로그아웃 상태면 null, 문서가 아직 없으면 { id } */
  me: Profile | null;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AppUser | null>(null);
  const user = account?.member ? account : null;
  const outsider = account && !account.member ? account : null;
  const [authReady, setAuthReady] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [eventsReady, setEventsReady] = useState(false);

  // 게임 목록은 누구나 볼 수 있다
  useEffect(() => store.watchGames(setGames), []);

  useEffect(
    () =>
      store.onUser((u) => {
        setAccount(u);
        signedInOutsider = !!u && !u.member;
        setAuthReady(true);
      }),
    []
  );

  // 프로필·미등록 친구·일정은 회원만 읽을 수 있다 (firestore.rules)
  const uid = user?.uid;
  useEffect(() => {
    setProfiles([]);
    setGuests([]);
    setEvents([]);
    setEventsReady(false);
    if (!uid) return;
    const unsubs = [
      store.watchProfiles(setProfiles),
      store.watchGuests(setGuests),
      store.watchEvents((evs) => {
        setEvents(evs);
        setEventsReady(true);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const value = useMemo<AppState>(() => {
    const me = user ? profiles.find((p) => p.id === user.uid) || { id: user.uid } : null;
    return { user, outsider, authReady, games, profiles, guests, events, eventsReady, me };
  }, [user, outsider, authReady, games, profiles, guests, events, eventsReady]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

// requireLogin은 컴포넌트 밖에서도 불리므로 비회원 로그인 여부를 모듈 변수로 둔다
let signedInOutsider = false;

/** 회원이 아니면 로그인 창을 띄우거나(로그아웃 상태) 초대 안내를 하고 false */
export function requireLogin(user: AppUser | null) {
  if (user) return true;
  if (signedInOutsider) {
    toast("초대받은 친구만 쓸 수 있어요. 친구에게 초대 링크를 받아 주세요");
    return false;
  }
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
  const { user, me, games, profiles, guests } = useApp();

  const playedBy = (gid: string) => profiles.filter((p) => p.played?.[gid]);
  // 내 것, 가입한 친구, 미등록 친구 순서
  const ownersOf = (gid: string): Owner[] => [
    ...profiles
      .filter((p) => p.owned?.[gid])
      .sort((a, b) => Number(b.id === user?.uid) - Number(a.id === user?.uid))
      .map((p) => ({ id: p.id, name: displayName(p) || "익명" })),
    ...guests.filter((g) => g.owned?.[gid]).map((g) => ({ id: g.id, name: g.name, guest: true })),
  ];

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
    // 모임을 다녀온 뒤 그 날짜로 플레이 기록을 남긴다
    async markPlayed(gid: string, date: string) {
      if (!requireLogin(user)) return;
      await store
        .setProfileField(user!.uid, `played.${gid}`, { rating: 0, date })
        .then(() => toast("플레이 기록을 남겼어요. 별점도 매겨 주세요!"))
        .catch(showError);
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

    ownersOf,
    // 게임 한 개를 친구 여러 명이 가지고 있을 수 있으므로 보유자마다 한 벌씩 대여 상태를 본다
    copiesOf(g: Game): Copy[] {
      return ownersOf(g.id).map((owner) => ({ owner, rental: g.rentals?.[owner.id] }));
    },

    async toggleOwned(g: Game) {
      if (!requireLogin(user)) return;
      const on = me?.owned?.[g.id];
      const rental = g.rentals?.[user!.uid];
      if (on && rental) {
        if (!confirm(`${rental.name}님이 내 '${g.name}'을(를) 대여 중이에요. 보유를 해제하면 대여 기록도 사라져요. 계속할까요?`)) return;
        await store.returnGame(g.id, user!.uid).catch(showError);
      }
      await store.setProfileField(user!.uid, `owned.${g.id}`, on ? null : true).catch(showError);
    },

    // 미등록 친구의 보유 목록은 로그인한 누구나 고칠 수 있다
    async setGuestOwned(guest: Guest, g: Game, on: boolean) {
      if (!requireLogin(user)) return;
      const rental = g.rentals?.[guest.id];
      if (!on && rental) {
        if (!confirm(`${rental.name}님이 ${guest.name}님의 '${g.name}'을(를) 대여 중이에요. 보유를 해제하면 대여 기록도 사라져요. 계속할까요?`))
          return;
        await store.returnGame(g.id, guest.id).catch(showError);
      }
      await store.setGuestField(guest.id, `owned.${g.id}`, on ? true : null).catch(showError);
    },
    async deleteGuest(guest: Guest) {
      if (!requireLogin(user) || !confirm(`미등록 친구 '${guest.name}'을(를) 삭제할까요? 이 친구의 보유 목록과 대여 기록도 사라져요.`)) return;
      try {
        await Promise.all(games.filter((g) => g.rentals?.[guest.id]).map((g) => store.returnGame(g.id, guest.id)));
        await store.deleteGuest(guest.id);
      } catch (err) {
        showError(err);
      }
    },

    // 남이 가진 게임 중 아무도 빌려 가지 않은 것만 대여할 수 있다
    async rentGame(g: Game, owner: Owner) {
      if (!requireLogin(user)) return;
      if (owner.id === user!.uid || g.rentals?.[owner.id]) return;
      const name = displayName(me) || user!.name || "익명";
      await store
        .rentGame(g.id, owner.id, { uid: user!.uid, name, date: ymd() })
        .then(() => toast(`${owner.name}님의 '${g.name}'을(를) 대여했어요`))
        .catch(showError);
    },
    // 빌린 사람이 아니어도 (예: 주인이 돌려받았을 때) 반납 처리할 수 있게 둔다
    async returnGame(g: Game, owner: Owner) {
      const rental = g.rentals?.[owner.id];
      if (!requireLogin(user) || !rental) return;
      if (rental.uid !== user!.uid && !confirm(`${rental.name}님이 빌린 '${g.name}'을(를) 반납 처리할까요?`)) return;
      await store
        .returnGame(g.id, owner.id)
        .then(() => toast("반납 처리했어요"))
        .catch(showError);
    },
  };
}
