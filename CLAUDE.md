# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

"머더미스터리 클럽": 지인들끼리 머더미스터리 게임 소개, 플레이 기록, 일정 모집을 공유하는 사이트입니다. 빌드 도구나 번들러, npm 의존성 없이 순수 HTML/CSS/JS(ES 모듈)로 만들었고, Firebase Hosting과 Firestore, Google 로그인을 사용합니다. Firebase SDK는 `gstatic.com` CDN URL에서 직접 import합니다(v10.12.2).

- Firebase 프로젝트 ID: `mahamuder` (`.firebaserc`), 배포 URL: https://mahamuder.web.app
- GitHub: https://github.com/reno-del/mahamurder (저장소 이름 철자가 프로젝트 ID와 다름)
- 빌드, 린트, 테스트 설정은 없습니다. `public/`이 그대로 배포됩니다.

## 명령어

```bash
firebase serve --only hosting          # 로컬 미리보기 (http://localhost:5000), 실제 Firestore에 연결됨
firebase deploy --only hosting         # 사이트 배포
firebase deploy --only firestore       # firestore.rules / firestore.indexes.json 배포
```

이 PC 환경에 관한 메모:
- `git`은 `C:\Program Files\Git\cmd\git.exe`, `firebase`는 `%APPDATA%\npm\firebase.cmd`에 설치되어 있습니다. 설치 전에 열린 셸에서는 PATH에 잡히지 않으므로 전체 경로로 실행하세요.
- 샌드박스 셸에서는 Firebase 로그인 정보와 전역 npm 설치가 보이지 않습니다. `firebase`와 `git push`는 샌드박스 밖에서 실행해야 합니다.

## 아키텍처

**백엔드 교체 구조** (`js/store.js`): `config.js`의 `firebaseConfig.apiKey`가 `YOUR_`로 시작하지 않으면 `backend-firebase.js`(Firestore와 Auth)를, 그렇지 않으면 `backend-local.js`(localStorage 데모 모드, `prompt()`로 닉네임 로그인)를 top-level await로 동적 import합니다. 두 백엔드는 **같은 인터페이스**(`onUser`, `login`, `logout`, `watchGames`, `saveGame`, `deleteGame`, `seedGames`, `watchProfiles`, `setProfileField`, `watchEvents`, `createEvent`, `updateEvent`, `joinEvent`, `leaveEvent`, `deleteEvent`)를 구현합니다. 데이터 연산을 추가하거나 바꿀 때는 **두 파일을 모두 수정**해야 합니다.

**상태와 렌더링** (`js/app.js`):
- 전역 `state`(`user`, `games`, `profiles`, `events`, `me` getter)는 실시간 구독(`watch*`)이 채웁니다. 페이지는 `state`를 읽기만 하고, 쓰기는 `store`를 통해서만 합니다. 쓰기 결과는 구독을 통해 `state`로 돌아오고, `refresh()`가 다시 렌더링합니다.
- 해시 라우팅: `#/games`, `#/schedule`, `#/mypage`. 각 `pages/*.js`의 `render*(root, params)`가 `innerHTML`로 화면 전체를 다시 그립니다. 사용자 입력은 반드시 `util.js`의 `h()`로 이스케이프하세요.
- 데이터가 바뀔 때마다 다시 렌더링되므로, 입력 폼이 있는 화면은 `<dialog id="modal">`(`openModal`)을 쓰거나 `root.dataset.page` 가드로 입력값이 날아가지 않게 합니다(`mypage.js` 참고).
- `games`는 비로그인 상태에서도 구독합니다. `profiles`와 `events`는 로그인한 뒤에만 구독하고, 로그아웃하면 구독을 해제합니다.

**Firestore 데이터 모델** (권한은 `firestore.rules`가 강제함):
- `games/{id}`: 누구나 읽을 수 있고, 로그인한 사용자는 누구나 쓸 수 있습니다.
- `users/{uid}`: `googleName`, `photo`, `nickname`, `played.{gameId}: {rating, date}`, `liked.{gameId}: true`가 들어갑니다. 본인 문서만 쓸 수 있습니다. 중첩 필드는 `setProfileField(uid, "played.<id>", value)`처럼 점 경로로 갱신하며, `value === null`이면 필드를 삭제합니다.
- `events/{id}`: `hostUid`, `hostName`, `gameId`, `date`(`YYYY-MM-DD` 문자열), `participants.{uid}: name`이 들어갑니다. 주최자는 모든 필드를 수정할 수 있고, 다른 사람은 `participants`에서 자기 uid만 추가하거나 삭제할 수 있습니다. 클라이언트 쓰기 형태를 바꾸면 규칙도 함께 확인하세요.
- 표시 이름 우선순위는 `nickname`, 그다음 `googleName`입니다(`app.js`의 `displayName`).
