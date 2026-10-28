# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

"머더미스터리 클럽": 지인들끼리 머더미스터리 게임 소개, 플레이 기록, 일정 모집을 공유하는 사이트입니다. React 18, TypeScript, Vite로 만들었고, Firebase Hosting과 Firestore, Google 로그인을 사용합니다. 라우팅은 react-router의 `BrowserRouter`로 경로 주소(`/games`, `/games/<id>`, `/schedule`, `/library`, `/mypage`)를 씁니다(라우트는 `main.tsx`, 상단 메뉴는 `components/Layout.tsx`). 예전 해시 주소(`#/games` 등)로 들어오면 `main.tsx`가 렌더링 전에 같은 경로로 바꿉니다. `/games/<id>`는 게임 목록 위에 그 게임의 상세 모달을 띄우고, 모달을 닫으면 `/games`로 돌아갑니다(`GamesPage`). 다른 페이지(마이페이지·보유 게임·일정)에서 여는 게임 상세는 주소를 바꾸지 않는 모달입니다. Firebase Hosting은 `firebase.json`의 `cleanUrls`와 `**` → `/index.html` rewrite로 이 주소들을 처리합니다.

- Firebase 프로젝트 ID: `mahamuder` (`.firebaserc`), 배포 URL: https://mahamuder.web.app
- GitHub: https://github.com/reno-del/mahamurder (저장소 이름 철자가 프로젝트 ID와 다름).
- 커밋 작성자 이메일은 `85153521+reno-del@users.noreply.github.com`(레포 `git config user.email`)입니다. GitHub Contributors는 이 이메일로 계정을 찾으므로, 예전 `giwan328@naver.com`(kkk0328 계정으로 잡힘)으로 커밋하지 마세요.
- 기능 소개 문서: `README.md`(마크다운, mermaid 다이어그램), `feature-overview.html`, `feature-guide.html`(번호 핀 안내서). 셋 다 저장소 루트 `shots/*.png`(데모 모드 화면, 1920×1080)를 쓰므로 Artifact로 올릴 때 `shots/*`를 함께 올리고, 화면이 바뀌면 `npm run dev:demo` 화면을 다시 찍어 바꾼 뒤 핀 위치를 확인하세요.
- 테스트와 린트 설정은 없습니다. 검증은 `npm run typecheck`와 브라우저 확인(로그인·쓰기 기능은 `npm run dev:demo`)으로 합니다. 브라우저 패널용 실행 설정은 `.claude/launch.json`의 `dev-demo`(포트 5173)입니다. 데모 모드의 데이터는 브라우저 localStorage(`mm_games`, `mm_users`, `mm_guests`, `mm_events`, `mm_me`)에 있어서, 여러 친구가 필요한 화면은 이 값을 직접 채워 테스트할 수 있습니다.
- 브랜치: `main` 하나만 쓰고 배포도 `main`에서 합니다. 예전 `react-ts` 브랜치는 2026-10-21에 `main`으로 합쳐서 없앴습니다. 이전 버전(빌드 없는 순수 HTML/JS)은 `main` 기록의 커밋 `474506c`에 남아 있습니다.
- 2026-10-28에 RAG 챗봇(`chatbot/`, Python Firebase 함수 `functions/`, `ChatWidget`)과 Remotion 홍보 영상(`promo/`)을 저장소에서 지웠습니다(커밋 `dc16ae4`, 되살릴 때는 그 이전 기록). Firebase에 배포된 `chat` 함수(asia-northeast3)는 따로 지우기 전까지 남아 있을 수 있습니다.

## 명령어

```bash
npm run dev            # Vite 개발 서버, 실제 Firestore에 연결됨
npm run dev:demo       # 데모 모드(localStorage). 실제 데이터를 건드리지 않고 로그인·쓰기 기능을 테스트할 때 사용
npm run typecheck      # tsc
npm run build          # tsc + vite build -> dist/ (게임 페이지·sitemap 생성 포함, 네트워크 필요)
npm run preview        # dist/를 vite preview로 열기 (cleanUrls·rewrite는 적용 안 됨)
firebase serve --only hosting      # dist/를 실제 Hosting 규칙(cleanUrls·rewrite)대로 로컬에서 열기
firebase deploy --only hosting     # predeploy에서 npm run build가 자동 실행됨
firebase deploy --only firestore   # firestore.rules / firestore.indexes.json 배포
npm run deploy                     # 위 두 명령을 hosting → firestore 순서로 실행
```

자동 배포: `main`에 push하면 `.github/workflows/deploy.yml`(GitHub Actions)이 hosting → firestore 순서로 배포합니다(문서·스크린샷·CSV만 바뀐 push는 건너뜀, Actions 탭에서 수동 실행도 가능). 저장소 비밀값 `FIREBASE_SERVICE_ACCOUNT`(서비스 계정 `firebase-adminsdk-fbsvc@mahamuder.iam.gserviceaccount.com`의 키 JSON)는 2026-10-28에 등록했습니다. 다시 등록할 때는 콘솔(프로젝트 설정 → 서비스 계정 → 새 비공개 키)에서 받은 파일 경로를 gitignore된 `.env.secret`에 적고 `node scripts/set-deploy-secret.mjs`를 실행하세요. 기본 역할만으로는 배포가 403으로 실패하므로, 이 계정에 IAM 역할 서비스 사용량 소비자·Firebase 규칙 관리자·Cloud Datastore 색인 관리자를 추가해 두었습니다. 로컬에서 한 번에 배포할 때는 `npm run deploy`(같은 순서)를 씁니다. workflow 파일을 push하려면 `gh` 토큰에 `workflow` 권한이 있어야 합니다(`gh auth refresh -s workflow`).

배포 순서: hosting을 먼저, 이어서 firestore 규칙을 배포합니다(규칙이 먼저 올라가면 예전 화면의 게임 추가가 실패함). `config/invite` 문서(`code` 필드)가 없으면 새 회원은 가입할 수 없습니다(2026-10-21에 만들어 둠). 회원이 마이페이지 "친구 초대 링크 복사"에서 "초대 코드가 아직 설정되지 않았어요"를 보면 권한 문제가 아니라 이 문서가 없거나 `code`가 빈 것입니다.

이 PC 환경에 관한 메모:
- `git`은 `C:\Program Files\Git\cmd\git.exe`, Node 24는 `C:\Program Files\nodejs`(2026-10-28 winget `OpenJS.NodeJS.LTS`로 설치), `gh`는 `C:\Program Files\GitHub CLI\gh.exe`에 있습니다. 설치 전에 열린 셸에서는 PATH에 잡히지 않으므로 `$env:PATH = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:PATH"`를 앞에 붙이거나 전체 경로로 실행하세요. git push는 `gh` 자격 증명(reno-del, `workflow` 권한 포함)을 씁니다.
- Firebase CLI(15.34.1)는 Claude 앱 전용 AppData(`C:\Users\admin\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\npm\firebase.cmd`)에 설치되어 있습니다. Claude 셸에서는 `%APPDATA%\npm`으로 보이지만 사용자 터미널 패널(`run_in_terminal`)에서는 보이지 않으니 전체 경로로 실행하세요. `gh` 로그인도 터미널 패널에서는 보이지 않으므로, `gh auth refresh`처럼 브라우저 승인이 필요한 명령은 Claude 셸에서 백그라운드로 실행해 출력된 코드를 사용자에게 전달하세요. `firebase login`은 2026-10-28에 `somanbg@gmail.com`(mahamuder 소유자)으로 했고, 로그인 정보는 `~/.config/configstore`에 있어 양쪽에서 함께 쓰입니다.
- 샌드박스 셸에서는 Firebase 로그인 정보와 전역 npm 설치가 보이지 않습니다. `npm`, `firebase`, `git push`는 샌드박스 밖에서 실행해야 합니다. 특히 `npm run build`는 Firestore에서 게임 목록을 받아 오므로, 네트워크가 막힌 곳에서 돌리면 경고만 남기고 게임 페이지·게임 목록이 빠진 결과물이 나옵니다. 배포 전 빌드 로그에 `게임 N개를 ... 만들어요`가 찍히는지 확인하세요.
- GitHub 정보(contributors, 커밋 작성자 계정, Actions 실행 결과 등)는 `gh`로 읽습니다(`gh run list --repo reno-del/mahamurder`).
- 저장소 루트의 `murder_mystery_games.csv`는 머더미스터리 게임 목록 데이터(보드라이프 기준, 2026-10-21부터 저장소에 포함)입니다. 커밋할 때는 `git add -A` 대신 파일을 지정해서 추가하세요(로컬에만 둔 파일이 섞이지 않게). CSV에 게임을 모으는 것은 `update-mm-games`, 사이트로 옮기는 것은 `import-csv-games` 스킬(게임 목록의 "CSV 가져오기", 변환은 `src/lib/csvGames.ts`)이 맡습니다.
- PowerShell 5.1에서 `git push`는 진행 메시지를 stderr로 내보내 성공해도 `NativeCommandError`·exit 255처럼 보입니다. `main -> main` 줄이나 `git status -sb`로 성공 여부를 판단하세요.
- `ffmpeg`는 설치되어 있지 않습니다. 헤드리스 브라우저가 필요하면 Edge(`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`)를 `puppeteer-core`로 띄우면 됩니다.
- 게임 표지(`img.boardlife.co.kr`)는 다른 사이트에서 불러오는 것을 막아서 localhost나 헤드리스 캡처에서는 이미지가 깨집니다. Node `fetch`로는 정상으로 받아지므로, 캡처할 때는 요청을 가로채 Node에서 받은 이미지로 대신 응답하세요.
- PATH의 Python은 3.14(`%LOCALAPPDATA%\Python\bin\python.exe`)뿐입니다. 사이트 쪽 일괄 수정 스크립트는 `node`로 작성하세요.
- 모드별 env 값은 `node -e "import('vite').then(v=>console.log(v.loadEnv('demo','.','VITE_')))"`로 확인합니다(`.env`는 모든 모드에서 읽히고 `.env.demo`가 그 위에 덧씌워짐).
- Node 24는 `.ts` 파일을 바로 import할 수 있어(`import type`만 쓰면) `src/lib`의 순수 모듈을 node 스크립트로 시험할 수 있습니다. skill-creator의 python 스크립트(`generate_review.py` 등)는 돌지 않으니 node로 옮겨 씁니다.
- `isolation: "worktree"` 서브에이전트의 작업 폴더는 로컬 `main`이 아니라 `origin/main`에서 만들어집니다. push하지 않은 커밋이 필요하면 먼저 push하거나 그 차이를 감안하세요.
- Firebase CLI 로그인 정보로 Firestore REST에 직접 쓰는 것은 auto mode 권한 검사가 막습니다. `config/*`처럼 콘솔에서만 바꾸는 데이터는 Claude in Chrome으로 Firebase 콘솔(사용자 로그인됨)에서 고치세요. 없는 문서 경로에서 "필드 추가"는 저장되지 않으니, 컬렉션의 "문서 추가"에서 문서 ID를 직접 입력하세요.
- Java가 없어 Firestore 에뮬레이터를 쓸 수 없습니다. 규칙 문법은 `firebase deploy --only firestore:rules --dry-run`(샌드박스 밖)으로 컴파일만 확인합니다. 규칙에 검증을 추가하기 전에는 공개 REST(`https://firestore.googleapis.com/v1/projects/mahamuder/databases/(default)/documents/games?pageSize=300`)를 Node `fetch`로 읽어 기존 문서가 조건을 통과하는지 확인하세요.
- 파일 전체를 셸로 다시 쓰면 Vite 개발 서버가 쓰는 도중의 빈 파일을 캐시할 수 있습니다. 콘솔에 `does not provide an export named` 오류가 뜨면 `dev-demo` 미리 보기를 껐다 켜세요.
- 데모 모드를 브라우저 패널에서 테스트할 때는 `prompt()`/`confirm()` 창이 자동화를 멈춥니다. 먼저 JS로 `window.prompt = () => "탐정"; window.confirm = () => true`를 넣은 뒤 버튼을 누르세요. 파일 입력은 JS로 `DataTransfer`에 `File`을 넣고 `change`를 보내면 되고(Vite 개발 서버는 저장소 루트 파일을 `/murder_mystery_games.csv`처럼 내줌), 실제 사이트에서는 Claude in Chrome의 `file_upload`로 로컬 파일을 올릴 수 있습니다.

## 아키텍처

**백엔드 교체 구조** (`src/store.ts`): `config.ts`의 `isConfigured`가 참이면 `backend/firebase.ts`를, 거짓이면 `backend/local.ts`(localStorage 데모 모드, `prompt()`로 닉네임 로그인)를 top-level await로 동적 import합니다. 그래서 `vite.config.ts`의 빌드 target은 es2022입니다. Firebase 설정값은 저장소 루트 `.env`의 `VITE_FIREBASE_*`에서 읽습니다(웹 API 키는 공개 값이라 커밋함). `seo/plugin.ts`의 `PROJECT_ID`와 `src/data/site.ts`의 URL은 `.env`를 읽지 않으니 프로젝트를 바꾸면 함께 고치세요. `isConfigured`는 API 키가 비었거나 `YOUR_`로 시작하거나 `VITE_DEMO=1`(`.env.demo`)일 때 거짓이 됩니다. 두 백엔드는 `types.ts`의 `Store` 인터페이스를 구현하므로, 데이터 연산을 추가하거나 바꿀 때는 **인터페이스와 두 파일을 모두 수정**해야 합니다.

**상태** (`src/state/AppContext.tsx`):
- `AppProvider`가 `store.watch*` 실시간 구독으로 `games`, `profiles`, `guests`, `events`를 채웁니다. 컴포넌트는 `useApp()`으로 읽기만 하고, 쓰기는 `store`를 직접 호출합니다. 쓰기 결과는 구독을 통해 돌아와 다시 렌더링됩니다. 낙관적 업데이트는 없습니다.
- `games`는 비로그인 상태에서도 구독합니다. `profiles`, `guests`, `events`는 로그인한 uid가 있을 때만 구독합니다(규칙상 비로그인 사용자는 읽을 수 없음). 그래서 보유·대여 정보처럼 프로필에서 파생되는 값은 비로그인 상태에서 비어 있습니다.
- `me`는 로그아웃 상태면 `null`이고, 프로필 문서가 아직 도착하지 않았으면 `{ id }`입니다.
- `useGameHelpers()`는 플레이, 선호, 평점, 보유 토글과 대여·반납처럼 여러 페이지가 공유하는 동작을 모아 둔 훅입니다. 확인창(`confirm`)과 토스트도 이 안에서 처리하므로, 페이지에서 `store`의 대여·보유 메서드를 직접 부르기보다 이 훅을 쓰세요. 로그인이 필요한 동작은 `requireLogin(user)`로 막습니다.

**모달** (`src/components/Modal.tsx`): `useModal().openModal(<Component ... />)`로 하나뿐인 `<dialog>`에 내용을 띄웁니다. 내용으로는 스냅샷이 아니라 **id를 받아 `useApp()`에서 직접 찾는 컴포넌트**(`GameDetail`, `EventModal`, `OwnedGamePicker`)를 넘깁니다. 그래야 데이터가 바뀌면 모달도 자동으로 최신 상태가 됩니다. `data-close` 속성이 있는 버튼과 backdrop 클릭으로 닫힙니다. `openModal(content, { onClose })`로 닫힐 때 할 일을 넘길 수 있고(다른 내용으로 바뀌면 불리지 않음), `/games/<id>` 주소와 모달을 맞추는 데 씁니다. `<dialog>`의 close 이벤트는 비동기라, 닫고 곧바로 다른 내용을 여는 코드는 순서에 주의하세요. 모달은 라우트 트리 밖에 렌더링되므로, 페이지와 상태를 공유해야 하면 모듈 수준 상태를 씁니다(예: 달력 월 `lib/calendarView.ts`, 검색 필터와 마이페이지 탭은 각 파일의 모듈 변수).

**스타일**: 전역 CSS 파일 `src/styles/style.css` 하나만 사용합니다(CSS 모듈이나 CSS-in-JS는 쓰지 않음). 이전 버전의 클래스 이름(`card`, `btn btn-primary`, `modal`, `cal-day` 등)을 그대로 이어받았으므로, 새 컴포넌트도 기존 클래스를 재사용하세요.

**SEO·AEO·GEO** (`seo/plugin.ts`, `src/lib/seo.ts`, `src/data/site.ts`): 클라이언트에서 그리는 SPA이고 AI 크롤러는 대부분 JS를 실행하지 않습니다. 그래서 `npm run build` 때 Vite 플러그인이 Firestore 공개 REST API로 게임 목록을 읽어 `index.html`의 `#root` 안에 정적 HTML(게임 링크 목록·FAQ)과 JSON-LD(`WebSite`, `FAQPage`, 게임 주소 `ItemList`)를 넣습니다. 게임마다 `dist/games/<id>.html`도 따로 만들어 각자의 제목·설명·canonical·og 태그·JSON-LD(`BoardGame`, `BreadcrumbList`)와 정적 본문을 갖게 하고(index.html을 바탕으로 `<!--seo-static-->` 사이와 머리말만 바꿈), `sitemap.xml`(첫 화면 + 모든 게임 주소)·`robots.txt`·`llms.txt`를 만듭니다. 이 정적 내용은 React가 처음 렌더링할 때 사라집니다. 게임 목록은 빌드 시점 기준이라, 게임을 추가하면 다시 배포해야 그 게임의 정적 페이지가 생깁니다(그 전에는 `/games/<id>`가 rewrite로 일반 index.html을 받고 앱이 상세를 띄움). 실행 중에는 `useLiveStructuredData`(Layout)가 JSON-LD를 최신 게임 정보로 덮어씁니다(`/games/<id>`에서는 그 게임 하나). 네트워크가 없으면 게임 목록 없이 빌드됩니다. 사이트 설명과 FAQ는 `src/data/site.ts` 한 곳에서 고치면 정적 HTML·JSON-LD·llms.txt·게임 소개 페이지 FAQ에 모두 반영됩니다. 페이지별 탭 제목은 `usePageMeta`로 바꿉니다. 공유 이미지는 `public/og-image.png`(1200×630)입니다. 대여 기록 같은 개인 정보는 정적 HTML·구조화 데이터에 넣지 않습니다. 빌드 결과는 `.claude/launch.json`의 `build-preview`(vite preview, 포트 4173)로 확인할 수 있지만, `cleanUrls`·rewrite까지 실제 사이트와 같게 보려면 `hosting-local`(`firebase serve`, 포트 5000)을 쓰세요. `firebase serve`는 시작할 때의 `dist`를 기준으로 하므로 다시 빌드했으면 재시작해야 합니다.

**주의할 점**: `main.tsx`는 `StrictMode`로 렌더링하므로 개발 모드에서 effect가 두 번 실행됩니다. `useEffect` 콜백은 아무것도 반환하지 않거나 정리(cleanup) 함수만 반환해야 합니다. `useEffect(() => window.scrollTo(0, 0))`처럼 화살표 함수가 다른 값을 반환하면 화면 전체가 하얗게 됩니다. 구독 effect는 `store.watch*`가 돌려주는 해제 함수를 그대로 반환하면 됩니다.

**회원 제한**: 로그인만으로는 아무것도 읽거나 쓸 수 없고, `users/{uid}` 문서가 있는 회원만 됩니다(규칙의 `member()`). `users` 문서는 처음 만들 때 `inviteCode`가 `config/invite.code`(Firebase 콘솔에서 관리, 회원만 읽기 가능)와 같아야 합니다. 초대 링크는 `/join/<code>`(`pages/join/JoinPage.tsx`, 마이페이지의 "친구 초대 링크 복사")이고, 로그인 중에는 코드를 localStorage `mm_invite`에 기억해 둡니다. `useApp()`의 `user`는 회원만이고, 로그인했지만 회원이 아닌 사람은 `outsider`에 들어갑니다(`requireLogin`·`LoginRequired`가 초대 안내를 보여 줌). 데모 모드에서는 로그인하면 회원이고, `mm_me`에 `member: false`를 넣으면 비회원 화면을, 초대 코드 `demo`로 가입 흐름을 확인할 수 있습니다.

**Firestore 데이터 모델** (`src/types.ts`, 권한은 `firestore.rules`가 강제함):
- `games/{id}`: 누구나 읽을 수 있고, 회원은 누구나 추가·수정할 수 있습니다. 규칙이 필드 이름·타입·길이를 검사하고(`link`·`imageUrl`은 비었거나 http(s)만, 화면에서도 `safeUrl`), 새 게임에는 `createdBy`가 반드시 있어야 합니다. 정보 수정과 대여(`rentals`, 한 번에 한 벌)는 서로 다른 쓰기로 나뉘므로 필드를 추가하면 규칙의 `editableFields()`도 고치세요. 삭제는 등록한 사람(`createdBy`, 값이 없는 예전 게임은 누구나)만 할 수 있고, 플레이 기록·보유자·모집 공지가 걸린 게임은 화면에서 삭제를 막습니다(이 부분은 규칙이 아니라 `GameDetail`에서만 검사). `category`(분류 `murder`/`deduction`/`social`, 규칙이 세 값만 허용)가 있고, 값이 없는 게임은 `lib/category.ts`의 `categoryOf`가 예전 장르 태그 `genres`에서 정합니다(일괄 이전 없이 게임을 수정할 때 저장됨). `genres`는 배경 태그가 스포일러라 화면·검색·정적 HTML·JSON-LD에 쓰지 않고 분류를 정할 때만 씁니다. `localized`(정발 여부, 값이 없으면 정발됨)와 `rentals.{ownerUid}: {uid, name, date}`(그 사람이 가진 게임을 누가 빌려 갔는지)가 들어갑니다. 보유 여부는 게임이 아니라 각자의 `users/{uid}.owned`에 있고, 같은 게임을 여러 명이 가지고 있으면 한 벌씩 따로 빌립니다(`useGameHelpers().copiesOf`). 대여·반납은 `store.rentGame`/`returnGame`으로 하고, 모아 보는 화면은 `/library`(`pages/library/LibraryPage.tsx`)입니다. 보드라이프에서 옮긴 게임은 `releaseDate`가 연도만(`"2014"`)이고 `description`은 `영문명: …`/`디자이너: …` 같은 줄로 되어 있어, 영문명 중복 판정에 씁니다(`GameForm`은 연도만 있으면 텍스트 칸으로 보여 줌).
- `users/{uid}`: `played.{gameId}: {rating, date}`, `liked.{gameId}: true`, `owned.{gameId}: true`, `nickname`, `bio`, `prefNote`(좋아하는 스타일, 자유 입력), `prefLength`가 들어갑니다(예전 `prefGenres`는 스포일러 태그라 화면에서 읽지 않고, `prefLength`의 예전 값 `~2시간`은 `1~2시간`으로 보여 줌). 본인 문서만 쓸 수 있습니다. 중첩 필드는 `setProfileField(uid, "played.<id>", value)`처럼 점 경로로 갱신하며, `value === null`이면 필드를 삭제합니다.
- `guests/{id}`: 가입하지 않은 친구입니다. `name`, `owned.{gameId}: true`, `createdBy`가 들어가고, 로그인한 사용자는 누구나 읽고 쓸 수 있습니다. 게임 보유자로만 쓰이며 `rentals`의 키로 guest id가 들어갑니다. 보유자는 프로필과 guest를 합친 `Owner` 형태로 다룹니다(`useGameHelpers().ownersOf`).
- `events/{id}`: `hostUid`, `gameId`, `date`(`YYYY-MM-DD` 문자열), `participants.{uid}: name`이 들어갑니다. 주최자는 모든 필드를 수정할 수 있고, 다른 사람은 `participants`에서 자기 uid만 추가하거나 삭제할 수 있습니다. 클라이언트 쓰기 형태를 바꾸면 규칙도 함께 확인하세요. 공유 링크 `/schedule/<id>`는 일정 모달을 띄우고(`SchedulePage`, 지워진 일정 판별에 `eventsReady` 사용), 지난 모임의 "다녀왔어요"는 각자 자기 `played.<gameId>`에 모임 날짜로 기록합니다(규칙상 남의 기록은 못 씀).
- 표시 이름 우선순위는 `nickname`, 그다음 `googleName`입니다(`lib/format.ts`의 `displayName`).
