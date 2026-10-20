// Firestore 문서 형태. 권한은 firestore.rules 참고.

export interface Game {
  id: string;
  name: string;
  publisher?: string;
  price?: number | null;
  releaseDate?: string;
  rating?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playTime?: number | null; // 분
  difficulty?: string;
  genres?: string[];
  imageUrl?: string;
  link?: string;
  description?: string;
  localized?: boolean; // 정발 여부. 값이 없으면 정발된 게임으로 본다
  // 보유자 uid -> 그 사람의 게임을 누가 빌려 갔는지. 보유 여부 자체는 users/{uid}.owned에 있다
  rentals?: Record<string, Rental>;
}
export type GameInput = Omit<Game, "id"> & { id?: string };

export interface Rental {
  uid: string;
  name: string;
  date: string; // YYYY-MM-DD
}

export interface PlayRecord {
  rating: number;
  date: string; // YYYY-MM-DD
}

// users/{uid}
export interface Profile {
  id: string;
  googleName?: string;
  photo?: string;
  nickname?: string;
  bio?: string;
  played?: Record<string, PlayRecord>;
  liked?: Record<string, true>;
  owned?: Record<string, true>; // 내가 가지고 있는 게임
  prefGenres?: string[];
  prefLength?: string;
}

// guests/{id}: 사이트에 가입하지 않은 친구. 게임 보유자로만 쓰이고 로그인한 누구나 관리한다
export interface Guest {
  id: string;
  name: string;
  owned?: Record<string, true>;
  createdBy?: string; // 만든 사람 uid
}

// events/{id}
export interface GameEvent {
  id: string;
  gameId: string;
  gameName: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  minPlayers: number;
  maxPlayers: number;
  place?: string;
  note?: string;
  hostUid: string;
  hostName: string;
  participants?: Record<string, string>; // uid -> 이름
}
export type EventFields = Omit<GameEvent, "id" | "hostUid" | "hostName" | "participants">;
export type NewEvent = Omit<GameEvent, "id">;

export interface AppUser {
  uid: string;
  name: string;
  photo: string;
}

export type Unsubscribe = () => void;

// backend-firebase / backend-local 이 동일하게 구현하는 저장소 인터페이스
export interface Store {
  mode: "firebase" | "local";
  onUser(cb: (user: AppUser | null) => void): Unsubscribe;
  login(): Promise<void>;
  logout(): Promise<void>;

  watchGames(cb: (games: Game[]) => void): Unsubscribe;
  saveGame(game: GameInput): Promise<void>;
  deleteGame(id: string): Promise<void>;
  seedGames(): Promise<void>;
  // ownerUid의 게임을 빌리거나 반납한다
  rentGame(id: string, ownerUid: string, rental: Rental): Promise<void>;
  returnGame(id: string, ownerUid: string): Promise<void>;

  watchProfiles(cb: (profiles: Profile[]) => void): Unsubscribe;
  // path 예: "nickname", "played.<gameId>", "liked.<gameId>" / value가 null이면 필드 삭제
  setProfileField(uid: string, path: string, value: unknown): Promise<void>;

  watchGuests(cb: (guests: Guest[]) => void): Unsubscribe;
  createGuest(name: string, createdBy: string): Promise<void>;
  // path 예: "name", "owned.<gameId>" / value가 null이면 필드 삭제
  setGuestField(id: string, path: string, value: unknown): Promise<void>;
  deleteGuest(id: string): Promise<void>;

  watchEvents(cb: (events: GameEvent[]) => void): Unsubscribe;
  createEvent(ev: NewEvent): Promise<void>;
  updateEvent(id: string, data: Partial<EventFields>): Promise<void>;
  joinEvent(id: string, user: { uid: string; name: string }): Promise<void>;
  leaveEvent(id: string, uid: string): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
