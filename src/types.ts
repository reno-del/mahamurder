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
}
export type GameInput = Omit<Game, "id"> & { id?: string };

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
  prefGenres?: string[];
  prefLength?: string;
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

  watchProfiles(cb: (profiles: Profile[]) => void): Unsubscribe;
  // path 예: "nickname", "played.<gameId>", "liked.<gameId>" / value가 null이면 필드 삭제
  setProfileField(uid: string, path: string, value: unknown): Promise<void>;

  watchEvents(cb: (events: GameEvent[]) => void): Unsubscribe;
  createEvent(ev: NewEvent): Promise<void>;
  updateEvent(id: string, data: Partial<EventFields>): Promise<void>;
  joinEvent(id: string, user: { uid: string; name: string }): Promise<void>;
  leaveEvent(id: string, uid: string): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
