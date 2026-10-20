# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

"머더미스터리 클럽": 지인들끼리 머더미스터리 게임 소개, 플레이 기록, 일정 모집을 공유하는 사이트입니다. React 18, TypeScript, Vite로 만들었고, Firebase Hosting과 Firestore, Google 로그인을 사용합니다. 라우팅은 react-router의 `HashRouter`를 써서 기존 주소(`#/games`, `#/schedule`, `#/mypage`)를 그대로 유지하고, 보유 게임·대여 화면 `#/library`가 추가되어 있습니다(라우트는 `main.tsx`, 상단 메뉴는 `components/Layout.tsx`).

- Firebase 프로젝트 ID: `mahamuder` (`.firebaserc`), 배포 URL: https://mahamuder.web.app
- GitHub: https://github.com/reno-del/mahamurder (저장소 이름 철자가 프로젝트 ID와 다름)
- 테스트와 린트 설정은 없습니다. 검증은 `npm run typecheck`와 브라우저 확인(로그인·쓰기 기능은 `npm run dev:demo`)으로 합니다. 브라우저 패널용 실행 설정은 `.claude/launch.json`의 `dev-demo`(포트 5173)입니다. 데모 모드의 데이터는 브라우저 localStorage(`mm_games`, `mm_users`, `mm_guests`, `mm_events`, `mm_me`)에 있어서, 여러 친구가 필요한 화면은 이 값을 직접 채워 테스트할 수 있습니다.
- 브랜치: React 버전은 `react-ts`에 있고, 배포된 사이트도 React 버전입니다(2026-10-20 `react-ts`에서 배포). `main`은 아직 이전 버전(빌드 없는 순수 HTML/JS)이므로, `main`에서 `firebase deploy`를 하면 사이트가 이전 버전으로 되돌아갑니다.

## 명령어

```bash
npm run dev            # Vite 개발 서버, 실제 Firestore에 연결됨
npm run dev:demo       # 데모 모드(localStorage). 실제 데이터를 건드리지 않고 로그인·쓰기 기능을 테스트할 때 사용
npm run typecheck      # tsc
npm run build          # tsc + vite build -> dist/
firebase deploy --only hosting     # predeploy에서 npm run build가 자동 실행됨
firebase deploy --only firestore   # firestore.rules / firestore.indexes.json 배포
```

이 PC 환경에 관한 메모:
- `git`은 `C:\Program Files\Git\cmd\git.exe`, `firebase`는 `%APPDATA%\npm\firebase.cmd`에 설치되어 있습니다. 설치 전에 열린 셸에서는 PATH에 잡히지 않으므로 전체 경로로 실행하세요.
- 샌드박스 셸에서는 Firebase 로그인 정보와 전역 npm 설치가 보이지 않습니다. `npm`, `firebase`, `git push`는 샌드박스 밖에서 실행해야 합니다.

## 아키텍처

**백엔드 교체 구조** (`src/store.ts`): `config.ts`의 `isConfigured`가 참이면 `backend/firebase.ts`를, 거짓이면 `backend/local.ts`(localStorage 데모 모드, `prompt()`로 닉네임 로그인)를 top-level await로 동적 import합니다. 그래서 `vite.config.ts`의 빌드 target은 es2022입니다. `isConfigured`는 API 키가 `YOUR_`로 시작하거나 `VITE_DEMO=1`(`.env.demo`)일 때 거짓이 됩니다. 두 백엔드는 `types.ts`의 `Store` 인터페이스를 구현하므로, 데이터 연산을 추가하거나 바꿀 때는 **인터페이스와 두 파일을 모두 수정**해야 합니다.

**상태** (`src/state/AppContext.tsx`):
- `AppProvider`가 `store.watch*` 실시간 구독으로 `games`, `profiles`, `guests`, `events`를 채웁니다. 컴포넌트는 `useApp()`으로 읽기만 하고, 쓰기는 `store`를 직접 호출합니다. 쓰기 결과는 구독을 통해 돌아와 다시 렌더링됩니다. 낙관적 업데이트는 없습니다.
- `games`는 비로그인 상태에서도 구독합니다. `profiles`, `guests`, `events`는 로그인한 uid가 있을 때만 구독합니다(규칙상 비로그인 사용자는 읽을 수 없음). 그래서 보유·대여 정보처럼 프로필에서 파생되는 값은 비로그인 상태에서 비어 있습니다.
- `me`는 로그아웃 상태면 `null`이고, 프로필 문서가 아직 도착하지 않았으면 `{ id }`입니다.
- `useGameHelpers()`는 플레이, 선호, 평점, 보유 토글과 대여·반납처럼 여러 페이지가 공유하는 동작을 모아 둔 훅입니다. 확인창(`confirm`)과 토스트도 이 안에서 처리하므로, 페이지에서 `store`의 대여·보유 메서드를 직접 부르기보다 이 훅을 쓰세요. 로그인이 필요한 동작은 `requireLogin(user)`로 막습니다.

**모달** (`src/components/Modal.tsx`): `useModal().openModal(<Component ... />)`로 하나뿐인 `<dialog>`에 내용을 띄웁니다. 내용으로는 스냅샷이 아니라 **id를 받아 `useApp()`에서 직접 찾는 컴포넌트**(`GameDetail`, `EventModal`, `OwnedGamePicker`)를 넘깁니다. 그래야 데이터가 바뀌면 모달도 자동으로 최신 상태가 됩니다. `data-close` 속성이 있는 버튼과 backdrop 클릭으로 닫힙니다. 모달은 라우트 트리 밖에 렌더링되므로, 페이지와 상태를 공유해야 하면 모듈 수준 상태를 씁니다(예: 달력 월 `lib/calendarView.ts`, 검색 필터와 마이페이지 탭은 각 파일의 모듈 변수).

**스타일**: 전역 CSS 파일 `src/styles/style.css` 하나만 사용합니다(CSS 모듈이나 CSS-in-JS는 쓰지 않음). 이전 버전의 클래스 이름(`card`, `btn btn-primary`, `modal`, `cal-day` 등)을 그대로 이어받았으므로, 새 컴포넌트도 기존 클래스를 재사용하세요.

**SEO·AEO·GEO** (`seo/plugin.ts`, `src/lib/seo.ts`, `src/data/site.ts`): 해시 라우팅 SPA라 검색엔진에는 사실상 `https://mahamuder.web.app/` 한 페이지만 잡히고, AI 크롤러는 대부분 JS를 실행하지 않습니다. 그래서 `npm run build` 때 Vite 플러그인이 Firestore 공개 REST API로 게임 목록을 읽어 `index.html`의 `#root` 안에 정적 HTML(게임 목록·FAQ)과 JSON-LD(`WebSite`, `FAQPage`, `BoardGame` 목록)를 넣고, `sitemap.xml`·`robots.txt`·`llms.txt`를 만듭니다. 이 정적 내용은 React가 처음 렌더링할 때 사라집니다. 게임 목록은 빌드 시점 기준이라 게임이 많이 바뀌면 다시 배포해야 하고, 실행 중에는 `useLiveStructuredData`(Layout)가 JSON-LD를 최신 목록으로 덮어씁니다. 네트워크가 없으면 게임 목록 없이 빌드됩니다. 사이트 설명과 FAQ는 `src/data/site.ts` 한 곳에서 고치면 정적 HTML·JSON-LD·llms.txt·게임 소개 페이지 FAQ에 모두 반영됩니다. 페이지별 탭 제목은 `usePageMeta`로 바꿉니다. 공유 이미지는 `public/og-image.png`(1200×630)입니다. 대여 기록 같은 개인 정보는 정적 HTML·구조화 데이터에 넣지 않습니다. 빌드 결과는 `.claude/launch.json`의 `build-preview`(포트 4173)로 확인할 수 있습니다.

**주의할 점**: `main.tsx`는 `StrictMode`로 렌더링하므로 개발 모드에서 effect가 두 번 실행됩니다. `useEffect` 콜백은 아무것도 반환하지 않거나 정리(cleanup) 함수만 반환해야 합니다. `useEffect(() => window.scrollTo(0, 0))`처럼 화살표 함수가 다른 값을 반환하면 화면 전체가 하얗게 됩니다. 구독 effect는 `store.watch*`가 돌려주는 해제 함수를 그대로 반환하면 됩니다.

**Firestore 데이터 모델** (`src/types.ts`, 권한은 `firestore.rules`가 강제함):
- `games/{id}`: 누구나 읽을 수 있고, 로그인한 사용자는 누구나 쓸 수 있습니다. `localized`(정발 여부, 값이 없으면 정발됨)와 `rentals.{ownerUid}: {uid, name, date}`(그 사람이 가진 게임을 누가 빌려 갔는지)가 들어갑니다. 보유 여부는 게임이 아니라 각자의 `users/{uid}.owned`에 있고, 같은 게임을 여러 명이 가지고 있으면 한 벌씩 따로 빌립니다(`useGameHelpers().copiesOf`). 대여·반납은 `store.rentGame`/`returnGame`으로 하고, 모아 보는 화면은 `#/library`(`pages/library/LibraryPage.tsx`)입니다.
- `users/{uid}`: `played.{gameId}: {rating, date}`, `liked.{gameId}: true`, `owned.{gameId}: true`, `nickname`, `bio`, `prefGenres`, `prefLength`가 들어갑니다. 본인 문서만 쓸 수 있습니다. 중첩 필드는 `setProfileField(uid, "played.<id>", value)`처럼 점 경로로 갱신하며, `value === null`이면 필드를 삭제합니다.
- `guests/{id}`: 가입하지 않은 친구입니다. `name`, `owned.{gameId}: true`, `createdBy`가 들어가고, 로그인한 사용자는 누구나 읽고 쓸 수 있습니다. 게임 보유자로만 쓰이며 `rentals`의 키로 guest id가 들어갑니다. 보유자는 프로필과 guest를 합친 `Owner` 형태로 다룹니다(`useGameHelpers().ownersOf`).
- `events/{id}`: `hostUid`, `gameId`, `date`(`YYYY-MM-DD` 문자열), `participants.{uid}: name`이 들어갑니다. 주최자는 모든 필드를 수정할 수 있고, 다른 사람은 `participants`에서 자기 uid만 추가하거나 삭제할 수 있습니다. 클라이언트 쓰기 형태를 바꾸면 규칙도 함께 확인하세요.
- 표시 이름 우선순위는 `nickname`, 그다음 `googleName`입니다(`lib/format.ts`의 `displayName`).
