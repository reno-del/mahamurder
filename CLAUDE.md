# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

"머더미스터리 클럽": 지인들이 머더미스터리 게임 소개·플레이 기록·모임 일정을 공유하는 사이트. React 18 + TypeScript + Vite, Firebase Hosting·Firestore·Google 로그인.

- Firebase 프로젝트 `mahamuder`, https://mahamuder.web.app · GitHub `reno-del/mahamurder`(철자 다름)
- 브랜치는 `main` 하나, 배포도 `main`. 빌드 없던 옛 버전은 커밋 `474506c`, 지운 RAG 챗봇·Remotion 영상은 `dc16ae4` 이전 기록(배포된 함수 없음).
- 커밋 이메일은 `85153521+reno-del@users.noreply.github.com`(레포 설정). 옛 `giwan328@naver.com` 금지.
- 라우팅: `BrowserRouter`(라우트 `main.tsx`, 메뉴 `components/Layout.tsx`). 옛 해시 주소(`#/games`)는 `main.tsx`가 렌더링 전에 바꿈. `/games/<id>`는 목록 위 상세 모달(닫으면 `/games`), 다른 페이지의 게임 상세는 주소를 안 바꾸는 모달. Hosting은 `cleanUrls` + `**` → `/index.html`.
- 문서: `README.md`, `feature-overview.html`, `feature-guide.html`(번호 핀)이 `shots/*.png`(데모 화면 1920×1080)를 씀 → Artifact로 올릴 때 `shots/*` 함께. 화면이 바뀌면 `npm run dev:demo`에서 뷰포트 1280×720·`deviceScaleFactor` 1.5, `.demo-banner` 숨기고 다시 찍고, 핀은 `getBoundingClientRect()` %로 맞춤. 기획은 `docs/PRD-*.md`(남은 것은 7절 "열린 질문").
- 테스트·린트 없음. 검증은 `npm run typecheck` + 브라우저(쓰기 기능은 `dev:demo`, `.claude/launch.json`의 `dev-demo` 포트 5173).
- 데모 데이터는 localStorage `mm_games`·`mm_users`·`mm_guests`·`mm_events`(배열 아닌 `{ id: 문서 }`)와 `mm_me`. 기본 게임은 4개뿐이라 여러 친구가 필요한 화면은 직접 채워 테스트. 일정은 기본값이 없음 → `mm_events`에 `{ id, hostUid, hostName, gameId, gameName, date, time, place, minPlayers, maxPlayers, participants: { uid: name } }`를 넣고 `/schedule/<id>`로 열기(`mm_me.uid`가 기본 `u1`).

## 명령어

```bash
npm run dev            # 실제 Firestore
npm run dev:demo       # 데모 모드(localStorage)
npm run typecheck
npm run build          # tsc + vite build -> dist/ (게임 페이지·sitemap 생성, 네트워크 필요)
npm run preview        # vite preview (cleanUrls·rewrite 없음)
firebase serve --only hosting      # 실제 Hosting 규칙대로 dist/ 열기
firebase deploy --only hosting     # predeploy로 build 자동 실행
firebase deploy --only firestore   # rules·indexes
npm run deploy                     # hosting → firestore
```

**배포**
- 순서는 항상 hosting → firestore(규칙이 먼저면 예전 화면의 게임 추가가 실패).
- `main`에 push하면 `.github/workflows/deploy.yml`이 같은 순서로 배포(문서·스크린샷·CSV만 바뀌면 건너뜀, 수동 실행 가능). push 후 `gh run watch <id> --repo reno-del/mahamurder --exit-status`, `gh run view <id> --log`에 `게임 N개를 ... 만들어요`가 있는지 확인.
- 비밀값 `FIREBASE_SERVICE_ACCOUNT`(서비스 계정 `firebase-adminsdk-fbsvc@mahamuder.iam.gserviceaccount.com` 키). 재등록: 콘솔에서 받은 키 경로를 `.env.secret`에 적고 `node scripts/set-deploy-secret.mjs`. 이 계정에는 서비스 사용량 소비자·Firebase 규칙 관리자·Cloud Datastore 색인 관리자 역할이 추가돼 있어야 함(없으면 403).
- workflow 파일 push에는 `gh` 토큰의 `workflow` 권한 필요(`gh auth refresh -s workflow`).
- `config/invite` 문서의 `code`가 없거나 비면 가입 불가, 마이페이지에 "초대 코드가 아직 설정되지 않았어요"가 뜸(권한 문제 아님).

## 이 PC 환경

**도구 위치·실행**
- `git` `C:\Program Files\Git\cmd`, Node 24 `C:\Program Files\nodejs`, `gh` `C:\Program Files\GitHub CLI`. PATH에 없으면 `$env:PATH = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:PATH"`.
- Firebase CLI는 Claude 앱 AppData(`C:\Users\admin\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\npm\firebase.cmd`)에 있어 터미널 패널에서는 전체 경로로 실행. `gh` 로그인도 터미널 패널에선 안 보이므로 브라우저 승인 명령은 Claude 셸에서 백그라운드로 돌리고 코드를 사용자에게 전달. firebase 로그인은 `somanbg@gmail.com`(`~/.config/configstore`).
- 샌드박스 셸에선 Firebase 로그인·전역 npm이 안 보임 → `npm`, `firebase`, `git push`, `gh`는 샌드박스 밖에서. 네트워크 없이 빌드하면 게임 페이지가 빠진 결과가 나오니 로그의 `게임 N개를 ... 만들어요`를 확인. `dist/`를 안 건드리고 확인할 땐 `npx vite build --outDir <스크래치> --emptyOutDir`. `build-preview`·`hosting-local`은 `dist/`만 열므로 스크래치 빌드를 보려면 `dist/`에 복사(`dist/`는 gitignore).
- Python은 3.14뿐 → 일괄 스크립트는 node로(skill-creator의 python 스크립트도 node로 옮겨 씀). `ffmpeg` 없음. 헤드리스 브라우저는 Edge(`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) + `puppeteer-core`.
- Java가 없어 Firestore 에뮬레이터 불가. 규칙은 `firebase deploy --only firestore:rules --dry-run`(샌드박스 밖)으로 컴파일만 확인하고 `[W]` 경고도 볼 것. 규칙 Set엔 `toList()`가 없어 map의 바뀐 키 값은 검사 못 함. 검증 추가 전엔 공개 REST(`https://firestore.googleapis.com/v1/projects/mahamuder/databases/(default)/documents/games?pageSize=300`)로 기존 문서가 통과하는지 확인.
- 모드별 env: `node -e "import('vite').then(v=>console.log(v.loadEnv('demo','.','VITE_')))"`(`.env` 위에 `.env.demo`).
- Node에서 `.ts`는 `import type`만 쓰는 파일(`category.ts` 등)만 바로 import 가능(`csvGames.ts`·`seo.ts`는 `ERR_MODULE_NOT_FOUND`). 경로는 `file:///C:/...`.
- `isolation: "worktree"` 서브에이전트는 `origin/main`에서 시작(push 안 한 커밋 없음).

**git**
- 줄바꿈이 파일마다 다름(`git ls-files --eol <파일>`). node로 고칠 땐 `\r\n`→`\n` 후 수정, 저장 시 원래대로.
- 한글 커밋 메시지는 Bash `git commit -F - <<'EOF'`로. 커밋 시 `git add -A` 대신 파일 지정.
- PowerShell 5.1의 `git push`는 성공해도 exit 255처럼 보임 → `main -> main`이나 `git status -sb`로 판단.
- GitHub 정보(contributors, Actions)는 `gh`로.

**게임 데이터 수집**
- `murder_mystery_games.csv`(보드라이프 기준 게임 목록). CSV 수집은 `update-mm-games`, 사이트 반영은 `import-csv-games` 스킬(변환 `src/lib/csvGames.ts`).
- 보드라이프는 Node `fetch`에 403 → 내장 브라우저로 boardlife.co.kr을 열고 페이지 안에서 `fetch('/game/<id>')`. 머미나우·텀블벅은 Node로 됨.
- 표지(`img.boardlife.co.kr`)는 핫링크 차단이라 localhost·헤드리스에서 깨짐. 캡처 시 요청을 가로채 Node `fetch`로 받은 이미지로 응답.

**실제 데이터 수정**
- 회원 권한으로 일괄 수정: Claude in Chrome(사용자 로그인됨)에서 mahamuder.web.app을 열고 `javascript_tool`로 `https://www.gstatic.com/firebasejs/10.14.1/`의 app·auth·firestore를 import → `.env` 설정으로 **이름 없는 기본 앱** `initializeApp`(이름 붙이면 로그인 못 읽음) → `auth.authStateReady()` → `updateDoc`. 규칙이 적용되므로 `editableFields()` 밖 필드는 실패. 내장 브라우저는 로그인 안 돼 있음.
- `javascript_tool` 결과에서 Firestore id·API 키가 가려짐: id는 `id.split("").join(" ")`로 출력, 키는 `index-*.js`가 참조하는 `assets/*.js`(동적 import 묶음)를 `fetch`해 `/AIza[0-9A-Za-z_-]{35}/`로 찾기.
- `config/*`와 남의 `users/{uid}`(예: guest의 `owned`를 회원에게 옮기기)는 Firebase 콘솔에서(Firebase CLI 자격으로 REST 쓰기는 auto mode가 막음). 없는 문서는 "필드 추가"가 저장 안 되니 "문서 추가"로 ID 입력. map 항목 여러 개는 JS로 안쪽 "필드 추가"를 여러 번 누르고 `input[name="ng.form0.0.mapChildren.N.fieldId"]`에 값 + `input` 이벤트, 유형·값은 `mat-select`의 `[class*=trigger]` → `mat-option`(`boolean`, `참`).

**브라우저 패널 테스트(데모)**
- `prompt()`/`confirm()`이 자동화를 멈춤 → 먼저 `window.prompt = () => "탐정"; window.confirm = () => true`.
- 내장 브라우저엔 `navigator.share`가 없음 → 모바일 뷰포트(`resize_window` mobile, `pointer: coarse` 됨)에서 `navigator.share = async d => { window.__shared = d }`로 바꿔 넣고 확인. 실제 공유 창은 배포 후 휴대폰에서.
- 파일 입력: `DataTransfer`에 `File`을 넣고 `change`(Vite가 루트 파일을 `/murder_mystery_games.csv`처럼 내줌). 실제 사이트는 Claude in Chrome `file_upload`.
- React 제어 입력(날짜 등): `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v)` 뒤 `input` 이벤트.
- 파일을 셸로 통째로 다시 쓰면 Vite가 빈 파일을 캐시할 수 있음 → `does not provide an export named`면 `dev-demo`를 재시작. 스택의 `?t=`가 편집 시각인 `createRoot`·`removeChild` 오류는 HMR 잔여물.

## 아키텍처

**백엔드 교체** (`src/store.ts`): `config.ts`의 `isConfigured`가 참이면 `backend/firebase.ts`, 거짓이면 `backend/local.ts`(localStorage, `prompt()` 닉네임 로그인)를 top-level await로 import(그래서 빌드 target es2022). `isConfigured`는 `.env`의 `VITE_FIREBASE_*` API 키가 비었거나 `YOUR_`로 시작하거나 `VITE_DEMO=1`이면 거짓. 두 백엔드는 `types.ts`의 `Store`를 구현하므로 **데이터 연산을 바꾸면 인터페이스와 두 파일 모두 수정**. 프로젝트를 바꾸면 `.env`를 안 읽는 `seo/plugin.ts`의 `PROJECT_ID`와 `src/data/site.ts` URL도 고칠 것.

**상태** (`src/state/AppContext.tsx`):
- `AppProvider`가 `store.watch*`로 `games`·`profiles`·`guests`·`events`를 구독. 컴포넌트는 `useApp()`으로 읽고 쓰기는 `store` 직접 호출(낙관적 업데이트 없음, 구독으로 반영).
- `games`는 비로그인도 구독, 나머지는 로그인 uid가 있을 때만(그래서 비로그인 땐 보유·대여 정보가 비어 있음).
- `me`: 로그아웃이면 `null`, 프로필 도착 전엔 `{ id }`.
- `useGameHelpers()`: 플레이·선호·평점·보유 토글, 대여·반납 등 공유 동작(확인창·토스트 포함, `requireLogin(user)`). 페이지에서 `store`의 대여·보유 메서드를 직접 부르지 말고 이걸 쓸 것.

**모달** (`src/components/Modal.tsx`): `useModal().openModal(<Comp />, { onClose })`로 하나뿐인 `<dialog>`에 띄움. 스냅샷이 아니라 **id를 받아 `useApp()`에서 찾는 컴포넌트**(`GameDetail`, `EventModal`, `OwnedGamePicker`)를 넘겨야 자동 갱신됨. `data-close` 버튼·backdrop으로 닫힘. `onClose`는 다른 내용으로 바뀌면 안 불림(`/games/<id>` 동기화에 사용). close 이벤트가 비동기라 닫자마자 다른 걸 열 때 순서 주의. 모달은 라우트 밖이라 페이지와 공유할 상태는 모듈 변수로(`lib/calendarView.ts`, 검색 필터, 마이페이지 탭).

**표지 격자** (`components/GameTiles.tsx`, 24개씩 "더 보기"): 마이페이지 "아직 안 해 본 게임", 친구 기록 모달(`pages/mypage/FriendGames.tsx`, `initialTab`: 위시리스트·플레이함·둘 다 안 해봄), `/tonight`(`pages/tonight/TonightPage.tsx`)에서 사용.
- `/tonight`: 고른 사람들의 보유 게임 중 아무도 안 해 본 게임. 빌려준 게임은 빌린 사람이 있을 때만("📦 친구(빌림)"). 인원 조건을 켜면 인원 정보 없는 게임은 따로 모으고 팀 계산에서 뺌. 4명 이상이면 `lib/teamSplit.ts`가 2~3팀 분할을 모두 열거하며 `lib/teamSplit.worker.ts`에서 돎.
- 모임 공지(`pages/schedule/EventForm.tsx`)는 `EventGamePicker`(`picker-grid`, 탭: 보유·내 게임·전체, 이름·분류·제작사 검색)로 고르고 고른 뒤엔 `cover-sm`으로 접음.

**Web Worker**: 무거운 계산은 `lib/*.worker.ts`(`new Worker(new URL("…", import.meta.url), { type: "module" })`). 데이터만 넘기고(`SplitInput`), effect 정리에서 `terminate()`.

**PWA**: `public/manifest.webmanifest`·아이콘·`public/sw.js`. 아이콘은 `icon.svg`가 원본: `<img src=icon.svg width=N>`만 있는 HTML을 스크래치에 두고 `msedge --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=N,N --screenshot=<out.png> <html>`로 512·192·180(`apple-touch-icon.png`) 렌더. 마스커블 안전 영역(중심 반지름 40%) 안에 그림을 둘 것. SW는 배포 빌드에서만 등록(`main.tsx`), 화면은 네트워크 우선(오프라인만 저장본), `/assets/*`만 캐시 우선, `/__/`(로그인)·외부 요청은 안 건드림. `build-preview`로 확인한 뒤엔 그 탭에서 SW 등록 해제.

**알림(웹 푸시)**: 서버가 없어 `.github/workflows/push.yml`이 10분마다 `scripts/send-push.mjs`(의존성 없음, 서비스 계정으로 Firestore REST·FCM v1)를 돌려 새 `events`와 `notices`(전체 공지, `pages/schedule/Notices.tsx`)를 `pushTokens/{FCM 토큰}: {uid}`로 보냄. 보낸 기록 `pushLog/{event_<id>|notice_<id>}`(규칙상 앱 접근 불가), `_init`이 없으면 기존 것은 표시만 하고, 하루 지난 것·지난 일정은 건너뜀. 알림 표시·클릭은 `sw.js`의 `push`/`notificationclick`(FCM data 메시지만 씀). 토큰은 기본 VAPID 키로 받고 localStorage `mm_push_token`, 데모는 `mm_push`만. 배포 빌드에서만 동작하고 아이폰은 홈 화면 앱에서만. 로컬 확인: `GOOGLE_APPLICATION_CREDENTIALS=<키 JSON> node scripts/send-push.mjs --dry-run`(샌드박스 밖).

**스타일**: 전역 `src/styles/style.css` 하나. 옛 클래스(`card`, `btn btn-primary`, `modal`, `cal-day` 등)를 재사용.

**SEO** (`seo/plugin.ts`, `src/lib/seo.ts`, `src/data/site.ts`): AI 크롤러는 JS를 안 돌리므로 빌드 때 Firestore 공개 REST로 게임 목록을 읽어
- `index.html`의 `#root`에 정적 HTML(게임 링크·FAQ)과 JSON-LD(`WebSite`, `FAQPage`, `ItemList`),
- 게임마다 `dist/games/<id>.html`(index.html의 `<!--seo-static-->` 사이와 머리말만 바꿔 제목·canonical·og·`BoardGame`·`BreadcrumbList`),
- `sitemap.xml`·`robots.txt`·`llms.txt`를 만든다.

정적 내용은 React 첫 렌더에서 사라지고, 실행 중엔 `useLiveStructuredData`(Layout)가 JSON-LD를 갱신. 새 게임의 정적 페이지는 재배포해야 생김(그 전엔 rewrite로 앱이 처리). 사이트 설명·FAQ는 `site.ts` 한 곳에서. 탭 제목은 `usePageMeta`, 공유 이미지 `public/og-image.png`(1200×630). 개인 정보(대여 등)는 정적 HTML·JSON-LD에 넣지 않음. "교회 청년 모임 … 초대제 사이트" 안내는 `GamesPage`에만 있고 `site.ts`엔 일부러 없음. 빌드 확인은 `build-preview`(4173) 또는 실제와 같은 `hosting-local`(`firebase serve`, 5000, 재빌드 후 재시작).

**주의할 점**
- `StrictMode`라 개발 모드에서 effect가 두 번 돔. `useEffect` 콜백은 아무것도 반환하지 않거나 정리 함수만 반환(`useEffect(() => window.scrollTo(0, 0))`는 화면이 하얘짐). 구독 effect는 `store.watch*`의 해제 함수를 그대로 반환.
- `<form>` 안 버튼은 `type="button"`, 검색칸은 `onKeyDown`에서 Enter 막기.
- 카톡 자동 전송은 사실상 불가(비즈 앱·검수·카카오 로그인 필요). 카카오톡 공유나 링크 복사를 쓸 것. 모집 카드 공유(`EventCard`)는 터치 기기(`pointer: coarse`)+`navigator.share`면 공유 시트(`text`에만 링크, `url` 따로 넘기면 카톡에 두 번 붙음), 아니면 클립보드 복사.

**회원 제한**: 규칙의 `member()` = `users/{uid}` 문서가 있는 사람만 읽기·쓰기 가능. `users` 문서 생성 시 `inviteCode`가 `config/invite.code`(콘솔 관리, 회원만 읽음)와 같아야 함. 초대 링크 `/join/<code>`(`pages/join/JoinPage.tsx`, 로그인 중엔 localStorage `mm_invite`에 보관). `useApp()`의 `user`는 회원만, 로그인한 비회원은 `outsider`(`requireLogin`·`LoginRequired`가 초대 안내). 데모: 로그인=회원, `mm_me`에 `member: false`면 비회원 화면, 초대 코드 `demo`로 가입 흐름.

**Firestore 데이터 모델** (`src/types.ts`, 권한은 `firestore.rules`):
- `games/{id}`: 누구나 읽고 회원 누구나 추가·수정. 규칙이 필드 이름·타입·길이 검사(`link`·`imageUrl`은 빈 값이나 http(s), 화면에선 `safeUrl`), 새 게임엔 `createdBy` 필수. 정보 수정과 대여는 별도 쓰기라 **필드를 추가하면 규칙 `editableFields()`도 수정**. 삭제는 `createdBy`(없으면 누구나)만, 기록·보유자·모집이 걸린 게임은 `GameDetail`에서만 막음.
  - `category`: `murder`/`deduction`/`social`(규칙이 강제). 없으면 `lib/category.ts`의 `categoryOf`가 `genres`에서 추정하고 수정 시 저장. `genres`는 스포일러라 분류 추정 외에는 화면·검색·SEO에 쓰지 않음.
  - `localized`(없으면 정발), `rentals.{ownerId}: {uid, name, date}`(보유자별 한 벌씩, `useGameHelpers().copiesOf`, `store.rentGame`/`returnGame`, 모아 보기 `/library`).
  - `storage.{ownerId}`: 교회 내 보관 위치. `store.setStorage`로 회원 누구나 한 벌씩(규칙 `changesOneStorage`, 30자 제한은 화면만). 기본 목록 `STORAGE_PLACES`(AppContext), 그 외 `StoragePicker` "직접 입력". 보유를 켜면 그 사람이 가장 많이 쓴 위치가 들어가고 끄거나 guest를 지우면 지워짐.
  - 보드라이프 출신 게임: `releaseDate`가 연도만(`"2014"`, `GameForm`은 텍스트 칸), `description`이 `영문명: …`/`디자이너: …` 줄 형식(영문명 중복 판정에 사용).
- `users/{uid}`(본인만 쓰기): `played.{gameId}: {rating, date}`, `liked.{gameId}: true`("선호"·"♡ 하고 싶어요"·"위시리스트"는 같은 값), `owned.{gameId}: true`, `nickname`, `bio`, `prefNote`, `prefLength`(옛 `~2시간`은 `1~2시간`으로 표시, 옛 `prefGenres`는 안 읽음). 중첩 필드는 `setProfileField(uid, "played.<id>", value)`, `null`이면 삭제.
- `guests/{id}`: 미가입 친구(`name`, `owned`, `createdBy`), 로그인한 누구나 읽고 씀. 보유자로만 쓰이고 `rentals` 키가 될 수 있음. 보유자는 프로필+guest를 합친 `Owner`(`useGameHelpers().ownersOf`). guest가 가입하면 `owned`와 `rentals` 키를 회원으로 옮겨야 하는데 화면 기능은 없음(콘솔에서).
- `events/{id}`: `hostUid`, `gameId`, `date`(`YYYY-MM-DD`), `participants.{uid}: name`. 주최자는 전부 수정, 다른 사람은 `participants`의 자기 uid만 추가·삭제(쓰기 형태를 바꾸면 규칙 확인). 공유 링크 `/schedule/<id>`는 일정 모달(`SchedulePage`, 지워진 일정 판별에 `eventsReady`). 지난 모임 "다녀왔어요"는 각자 자기 `played.<gameId>`에 모임 날짜로 기록.
- 표시 이름: `nickname` → `googleName`(`lib/format.ts`의 `displayName`).
