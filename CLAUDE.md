# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

"머더미스터리 클럽": 지인들끼리 머더미스터리 게임 소개, 플레이 기록, 일정 모집을 공유하는 사이트입니다. React 18, TypeScript, Vite로 만들었고, Firebase Hosting과 Firestore, Google 로그인을 사용합니다. 라우팅은 react-router의 `HashRouter`를 써서 기존 주소(`#/games`, `#/schedule`, `#/mypage`)를 그대로 유지합니다.

- Firebase 프로젝트 ID: `mahamuder` (`.firebaserc`), 배포 URL: https://mahamuder.web.app
- GitHub: https://github.com/reno-del/mahamurder (저장소 이름 철자가 프로젝트 ID와 다름)
- 테스트와 린트 설정은 없습니다. 검증은 `npm run typecheck`와 브라우저 확인으로 합니다.

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
- `AppProvider`가 `store.watch*` 실시간 구독으로 `games`, `profiles`, `events`를 채웁니다. 컴포넌트는 `useApp()`으로 읽기만 하고, 쓰기는 `store`를 직접 호출합니다. 쓰기 결과는 구독을 통해 돌아와 다시 렌더링됩니다. 낙관적 업데이트는 없습니다.
- `games`는 비로그인 상태에서도 구독합니다. `profiles`와 `events`는 로그인한 uid가 있을 때만 구독합니다(규칙상 비로그인 사용자는 읽을 수 없음).
- `me`는 로그아웃 상태면 `null`이고, 프로필 문서가 아직 도착하지 않았으면 `{ id }`입니다.
- `useGameHelpers()`는 플레이, 선호, 평점 토글처럼 여러 페이지가 공유하는 동작을 모아 둔 훅입니다. 로그인이 필요한 동작은 `requireLogin(user)`로 막습니다.

**모달** (`src/components/Modal.tsx`): `useModal().openModal(<Component ... />)`로 하나뿐인 `<dialog>`에 내용을 띄웁니다. 내용으로는 스냅샷이 아니라 **id를 받아 `useApp()`에서 직접 찾는 컴포넌트**(`GameDetail`, `EventModal`)를 넘깁니다. 그래야 데이터가 바뀌면 모달도 자동으로 최신 상태가 됩니다. `data-close` 속성이 있는 버튼과 backdrop 클릭으로 닫힙니다. 모달은 라우트 트리 밖에 렌더링되므로, 페이지와 상태를 공유해야 하면 모듈 수준 상태를 씁니다(예: 달력 월 `lib/calendarView.ts`, 검색 필터와 마이페이지 탭은 각 파일의 모듈 변수).

**Firestore 데이터 모델** (`src/types.ts`, 권한은 `firestore.rules`가 강제함):
- `games/{id}`: 누구나 읽을 수 있고, 로그인한 사용자는 누구나 쓸 수 있습니다.
- `users/{uid}`: `played.{gameId}: {rating, date}`, `liked.{gameId}: true`, `nickname`, `bio`, `prefGenres`, `prefLength`가 들어갑니다. 본인 문서만 쓸 수 있습니다. 중첩 필드는 `setProfileField(uid, "played.<id>", value)`처럼 점 경로로 갱신하며, `value === null`이면 필드를 삭제합니다.
- `events/{id}`: `hostUid`, `gameId`, `date`(`YYYY-MM-DD` 문자열), `participants.{uid}: name`이 들어갑니다. 주최자는 모든 필드를 수정할 수 있고, 다른 사람은 `participants`에서 자기 uid만 추가하거나 삭제할 수 있습니다. 클라이언트 쓰기 형태를 바꾸면 규칙도 함께 확인하세요.
- 표시 이름 우선순위는 `nickname`, 그다음 `googleName`입니다(`lib/format.ts`의 `displayName`).
