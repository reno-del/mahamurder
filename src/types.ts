// Firestore 문서 형태. 권한은 firestore.rules 참고.

export type Category = "murder" | "deduction" | "social";

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
  category?: Category | null; // 분류. 값이 없으면 genres에서 정한다 (lib/category.ts의 categoryOf)
  genres?: string[]; // 예전 장르 태그. 스포일러라 화면에 보여 주지 않고 분류를 정할 때만 쓴다
  imageUrl?: string;
  link?: string;
  description?: string;
  localized?: boolean; // 정발 여부. 값이 없으면 정발된 게임으로 본다
  createdBy?: string; // 등록한 사람 uid. 이 사람만 삭제할 수 있다 (값이 없는 예전 게임은 누구나)
  // 보유자 uid -> 그 사람의 게임을 누가 빌려 갔는지. 보유 여부 자체는 users/{uid}.owned에 있다
  rentals?: Record<string, Rental>;
  // 보유자 uid(또는 guest id) -> 그 사람의 게임을 교회 어디에 두었는지 (예: "신관 6층")
  storage?: Record<string, string>;
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
  prefGenres?: string[]; // 예전 선호 장르(태그). 스포일러라 화면에서는 더 이상 읽지 않는다
  prefNote?: string; // 좋아하는 스타일 (자유 입력)
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

// notices/{id}: 회원 누구나 쓰는 전체 공지. 새 일정과 함께 scripts/send-push.mjs가 알림을 켠 기기로 보낸다
export interface Notice {
  id: string;
  uid: string;
  name: string;
  text: string;
  createdAt?: number; // ms
}

// 이 기기의 알림 상태. ios: 아이폰·아이패드는 홈 화면에 추가한 앱에서만 받을 수 있음, denied: 브라우저에서 차단됨
export type PushState = "on" | "off" | "denied" | "ios" | "unsupported";

export interface AppUser {
  uid: string;
  name: string;
  photo: string;
  // 초대받아 users 문서가 있는 회원인지. 아니면 로그인만 했고 아무것도 읽거나 쓸 수 없다 (firestore.rules의 member())
  member: boolean;
}

export type Unsubscribe = () => void;

// backend-firebase / backend-local 이 동일하게 구현하는 저장소 인터페이스
export interface Store {
  mode: "firebase" | "local";
  onUser(cb: (user: AppUser | null) => void): Unsubscribe;
  login(): Promise<void>;
  logout(): Promise<void>;
  // 초대 코드로 회원이 된다. 로그인 전이면 코드를 기억해 두고 로그인부터 한다. 코드가 틀리면 예외
  join(code: string): Promise<void>;
  // 회원끼리 공유하는 초대 코드 (없으면 null)
  getInviteCode(): Promise<string | null>;

  watchGames(cb: (games: Game[]) => void): Unsubscribe;
  saveGame(game: GameInput): Promise<void>;
  deleteGame(id: string): Promise<void>;
  seedGames(): Promise<void>;
  // 여러 게임을 한 번에 새로 등록한다 (CSV 가져오기)
  importGames(games: GameInput[]): Promise<void>;
  // ownerUid의 게임을 빌리거나 반납한다
  rentGame(id: string, ownerUid: string, rental: Rental): Promise<void>;
  returnGame(id: string, ownerUid: string): Promise<void>;
  // ownerUid의 게임을 둔 위치를 바꾼다. place가 null이면 지운다
  setStorage(id: string, ownerUid: string, place: string | null): Promise<void>;

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

  watchNotices(cb: (notices: Notice[]) => void): Unsubscribe;
  createNotice(notice: Omit<Notice, "id" | "createdAt">): Promise<void>;
  deleteNotice(id: string): Promise<void>;

  // 이 기기로 알림 받기 (pushTokens/{FCM 토큰}에 uid를 남긴다)
  pushState(): Promise<PushState>;
  enablePush(uid: string): Promise<void>;
  disablePush(): Promise<void>;
}
