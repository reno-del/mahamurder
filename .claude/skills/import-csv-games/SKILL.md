---
name: import-csv-games
description: murder_mystery_games.csv(또는 같은 형식의 게임 목록 CSV)에 있는 게임을 "머더미스터리 클럽" 사이트의 게임 목록(Firestore games)에 넣는다. 게임 목록 화면의 "CSV 가져오기" 기능(파일 선택 → 사이트에 없는 게임만 골라 보여 줌 → 체크한 게임 등록)을 만들거나 고치고, 사용자가 원하면 실제 사이트에서 Claude in Chrome으로 CSV를 올려 새 게임을 등록한다. "CSV를 사이트에 올려 줘", "CSV 게임을 웹페이지에 추가", "새 데이터 사이트에 반영", "엑셀/CSV로 게임 일괄 등록", "CSV 가져오기 고쳐 줘", "CSV에 열이 바뀌었는데 가져오기가 안 돼"처럼 CSV 속 게임을 사이트 화면이나 Firestore로 옮기려는 요청이면 '가져오기'라는 말이 없어도 이 스킬을 쓴다. CSV 자체에 게임을 더 모으는 일(update-mm-games)과는 다르다. 보통 update-mm-games 다음 단계다.
---

# CSV 게임을 사이트에 넣기

저장소 루트의 `murder_mystery_games.csv`에는 보드라이프·텀블벅·머미나우에서 모은 게임이 수백 개 있고(`update-mm-games` 스킬이 늘림), 사이트(Firestore `games`)에는 그중 일부만 있다. 이 스킬은 **회원이 사이트에서 CSV 파일을 올려 없는 게임만 골라 등록하는 기능**을 쓰거나 만든다.

왜 이 방식인가: Firestore 규칙상 게임은 회원만 `createdBy = 본인 uid`로 만들 수 있고, 이 PC에서는 Firestore에 직접 쓰는 스크립트를 auto mode가 막는다. 사이트 안의 기능이면 규칙을 고치지 않고도 올린 회원 이름으로 등록되고, 사람이 목록을 보고 고른 뒤에 쓰게 된다. 그러니 Firestore에 직접 쓰거나 규칙을 느슨하게 만들지 말고, 화면 기능을 거친다.

아래에서 `SKILL`은 이 스킬 폴더(`.claude/skills/import-csv-games`)다.

## 0. 지금 상태부터 본다

```bash
ls src/lib/csvGames.ts src/pages/games/CsvImport.tsx 2>/dev/null; grep -n "importGames" src/types.ts
node SKILL/scripts/preview.mjs murder_mystery_games.csv
```

`preview.mjs`는 아무것도 쓰지 않고 CSV를 사이트 게임으로 바꿔 본 뒤, 실제 사이트(공개 REST)의 게임과 맞춰 "새 게임 / 비슷한 이름 / 이미 있음" 개수, 비슷한 이름 목록(까닭 포함), 규칙 위반 가능 행을 보여 준다. 네트워크가 필요하니 샌드박스 밖에서 실행한다. `src/lib/csvGames.ts`가 있으면 그것을, 없으면 `SKILL/assets/csvGames.ts`를 쓴다. 숫자가 이상하면(예: 새 게임이 거의 전부) 사이트 데이터 형식이 바뀌었을 수 있으니 1단계의 "형식 확인"을 한다.

- 기능이 없으면 → 1~5단계로 만들고, 실제 등록까지 원하면 6단계.
- 이미 있으면 → 요청에 맞는 부분만 고친다(열 이름이 바뀜 → `COLUMNS`, 중복 판정 → `matchExisting`, 화면 → `CsvImport.tsx`). 사이트에 반영만 원하면 바로 6단계.
- 지금 CSV가 GitHub에 push되지 않았어도 상관없다. 사이트에 올리는 것은 로컬 파일이다.

## 1. 변환 모듈 복사: `src/lib/csvGames.ts`

`SKILL/assets/csvGames.ts`를 그대로 `src/lib/csvGames.ts`로 복사한다. 새로 짜지 않는다: 이 모듈의 결과는 이미 사이트에 있는 보드라이프 게임 266개와 필드 하나하나까지 같게 맞춰 두었다(새 게임과 기존 게임이 같은 모양이어야 목록·상세·정렬이 고르게 보인다). 셸로 파일을 통째로 쓰면 Vite가 빈 파일을 캐시할 수 있으니 복사 후 미리 보기가 이상하면 재시작한다.

들어 있는 것:
- `readCsvFile(file)`: UTF-8로 읽고 깨지면 EUC-KR로 다시 읽음(엑셀 저장본 대비)
- `csvToGames(text, createdBy)`: 머리글 **이름**으로 열을 찾아 `GameInput[]`로 변환. 반환 `{ games: {row, game}[], skipped, missing }`
- `matchExisting(rows, games)`: 각 행에 `status: "new" | "similar" | "exists"`, 비슷한 사이트 게임 `existing`, 까닭 `reason`을 붙임

변환 규칙(기존 데이터에 맞춘 것, 바꾸려면 사용자와 상의):

| CSV 열 | 사이트 필드 | 규칙 |
|---|---|---|
| 게임명(한글) (없으면 영문) | `name` | 100자 이내 |
| 출판사 | `publisher` | 쉼표 목록의 첫 번째 그대로(`-`도 그대로). 100자 |
| 가격(원) | `price` | 숫자, 없으면 `null` |
| 출시연도 | `releaseDate` | **연도만** `"2014"` (날짜까지 있으면 `YYYY-MM-DD`) |
| 평점(10점) | `rating` | 5점 만점으로, 소수 첫째 자리 반올림(7.5 → 3.8) |
| 최소/최대인원, 플레이시간(분) | `minPlayers`/`maxPlayers`/`playTime` | 숫자, 최대 없으면 최소 |
| 난이도(1~5) | `difficulty` | 2 미만 쉬움, 3 미만 보통, 그 이상 어려움, 없으면 빈칸 |
| 장르 | `genres` | `" / "`로 나눔, 10개까지 |
| 이미지URL | `imageUrl` | http(s)만 |
| 보드라이프, 출처URL | `link` | 보드라이프 주소 우선, 없으면 출처URL의 첫 주소 |
| 영문명·디자이너·연령·언어의존도·난이도·확장·보드라이프 평점 | `description` | 한 줄에 하나: `영문명: …` / `디자이너: …` / `연령: …` / `언어 의존도: …` / `난이도: 1.58 / 5` / `확장판` / `보드라이프 평점 7.5 / 10 (337명)` |

`localized`(정발 여부)는 CSV에 정보가 없어 넣지 않는다(값이 없으면 정발로 보임).

**형식 확인** — 사이트 데이터 형식이 바뀌었을지 모를 때(새 필드, 사람이 손으로 고친 형식 등)는 공개 REST로 기존 보드라이프 게임을 읽어 같은 링크의 CSV 변환 결과와 필드별로 비교한다. 차이가 몇 개(사이트 쪽 값이 비었거나 `"0"` 같은 이상값)뿐이면 정상이다. 차이가 많으면 모듈을 사이트 쪽에 맞추고 `SKILL/assets/csvGames.ts`도 같이 고친다.

**중복 판정** — 순서대로:
1. 띄어쓰기·기호를 뺀 이름이 같거나 링크가 같으면 `exists`
2. CSV 안에서 앞 줄과 이름이나 영문명이 같으면 `exists`(CSV 안의 중복)
3. 사이트 게임 소개글의 `영문명:`과 영문명이 같으면 `similar` ("느와르: 연역적 미스터리 게임" ≈ "느와르: 디덕티브 미스테리 게임")
4. 한쪽 이름이 다른 쪽에 들어 있으면 `similar` (짧은 쪽이 4자 이상이고 긴 쪽의 30% 이상, "미스터리"처럼 장르 이름뿐인 이름은 제외). "머더 미스터리 미니: 별장 살인" ≈ "별장살인"처럼 시리즈 머리말 차이를 사람이 보고 고르게 하려는 것이다.

영문명 칸에 한글 이름이 그대로 들어간 게임(예: "미스터리 & 어드벤처 박스 01: 분가" — 사이트의 "…01: 불타는 저택"과 같은 게임)은 못 잡는다. 이런 것은 보고 때 알린다.

## 2. 저장소에 `importGames` 추가 (인터페이스 + 두 백엔드)

이 저장소는 `Store` 인터페이스를 Firebase와 데모(localStorage) 두 곳이 구현하므로 세 파일을 함께 고친다. `saveGame`을 수백 번 부르면 느리고 중간에 실패하면 일부만 들어가므로 배치로 쓴다.

- `src/types.ts`의 `Store`, `seedGames` 옆: `// 여러 게임을 한 번에 새로 등록한다 (CSV 가져오기)` + `importGames(games: GameInput[]): Promise<void>;`
- `src/backend/firebase.ts`: `seedGames`처럼 `writeBatch`를 쓰되, 배치 하나에 500개까지라 **400개씩 나눠** 커밋한다. 각 문서는 `{ ...g, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }`이고 `createdBy`는 화면에서 넣어 온다(`GameForm`과 같은 방식). `id`가 들어 있으면 빼고 `doc(collection(db, "games"))`로 새 id를 쓴다. 배치를 나누면 앞 배치만 들어가고 실패할 수 있으니, 실패 메시지에 몇 개까지 들어갔는지 담아 던진다.
- `src/backend/local.ts`: `seedGames`처럼 `read`/`write`로 한 번에 넣는다(`createdAt`/`updatedAt: now()`).

**규칙은 고칠 필요가 없다.** 넣는 필드(`name … description`, `createdBy`, `createdAt`, `updatedAt`)가 모두 `firestore.rules`의 `editableFields()` + `createdBy`/`createdAt` 안에 있고, 길이·URL 형식은 변환 모듈이 맞춘다. 변환 결과에 새 필드를 추가하게 되면 그때는 `editableFields()`·`validGame()`과 `GameForm`도 함께 고친다.

## 3. 가져오기 화면: `src/pages/games/CsvImport.tsx`

모달 내용 컴포넌트로 만든다. 프로젝트 관례대로 `useApp()`에서 `games`를 직접 읽어서, 다른 사람이 게임을 추가해도 판정이 최신이 되게 한다(파일 내용과 변환 결과만 state에 둔다).

화면 흐름:
1. 제목 `CSV로 게임 가져오기`, 짧은 안내("사이트에 아직 없는 게임만 골라 보여 줘요"), `<input type="file" accept=".csv,text/csv">`. 고르면 `readCsvFile` → `csvToGames(text)`. 이름 열이 없으면 `csvToGames`가 던지는 오류를 `showError`로.
2. `matchExisting(rows, games)` 결과를 보여 준다.
   - 요약(`.csv-import-summary`): `새 게임 N · 비슷한 이름 M · 이미 있음 K`(+ 건너뛴 줄이 있으면 그 수)
   - **새 게임**: 기본 체크. **비슷한 이름**: 기본 체크 해제, 옆에 `≈ 사이트의 "○○" (까닭)`. **이미 있음**: 목록에 넣지 않고 수만.
   - 각 줄: 체크박스, 이름, 인원·시간·장르 정도의 짧은 정보. 수백 줄이라 표지 이미지는 넣지 않는다.
   - 이름 검색 입력과 "모두 선택 / 모두 해제".
3. 버튼 `선택한 N개 등록`(`dialog .btn-primary`): `requireLogin(user)` → `confirm(`게임 ${n}개를 등록할까요?`)` → `store.importGames(selected.map(m => ({ ...m.game, createdBy: user.uid })))` → `toast(`${n}개 등록했어요`)` → `closeModal()`. 실패하면 `showError`. 등록하는 동안 버튼을 막는다(두 번 눌러 중복 등록 방지).

스타일은 `src/styles/style.css`의 기존 클래스(`btn`, `btn-primary`, `btn-sm`, `input`, `muted`, `empty`, `form-actions`)를 먼저 쓰고, 목록 스크롤처럼 꼭 필요한 것만 `.csv-import-…` 이름으로 조금 추가한다. 화면 문구는 해요체.

## 4. 진입 버튼과 주변 수정

- `src/pages/games/GamesPage.tsx`의 `+ 게임 추가` 버튼 옆에 `<button className="btn" onClick={() => requireLogin(user) && openModal(<CsvImport />)}>CSV 가져오기</button>`. 회원이 아니면 `requireLogin`이 초대 안내를 띄우므로 버튼을 숨길 필요는 없다.
- `.toolbar`는 칸 수가 정해진 grid(`grid-template-columns: 1fr repeat(5, auto) auto`)라 버튼을 하나 더하면 줄이 넘어간다. 끝에 `auto`를 하나 더한다.
- `src/pages/games/GameForm.tsx`의 출시일은 `type="date"` 입력이라 연도만 있는 값(`"2018"`, 기존 게임 대부분과 가져온 게임 전부)을 보여 주지 못하고 **저장하면 지워 버린다**. 값이 `^\d{4}$`이면 텍스트 입력(`pattern="\d{4}(-\d{2}-\d{2})?"`, placeholder `YYYY 또는 YYYY-MM-DD`)을 쓰게 한다. 이미 고쳐져 있으면 그대로 둔다.

## 5. 확인

1. `npm run typecheck`
2. `node SKILL/scripts/preview.mjs` — 이제 `src/lib/csvGames.ts`로 돌아가는지, 숫자가 0단계와 같은지
3. 브라우저 패널 `dev-demo`(포트 5173). 데모 모드라 실제 데이터는 안 건드린다. 실제 사이트와 같은 조건으로 보려면 사이트 게임을 데모 저장소에 채운다. 파일 선택 창은 자동화가 못 누르므로 JS로 파일을 넣는다(Vite 개발 서버는 저장소 루트 파일을 그대로 내준다):

```js
// 1) 사이트 게임을 데모에 채우고 회원으로 로그인 (이후 /games 새로 고침)
const j = await (await fetch("https://firestore.googleapis.com/v1/projects/mahamuder/databases/(default)/documents/games?pageSize=300")).json();
const val = (x) => x == null ? undefined : "stringValue" in x ? x.stringValue : "integerValue" in x ? +x.integerValue : "doubleValue" in x ? x.doubleValue : "nullValue" in x ? null : "booleanValue" in x ? x.booleanValue : "arrayValue" in x ? (x.arrayValue.values || []).map(val) : undefined;
localStorage.mm_games = JSON.stringify(Object.fromEntries(j.documents.map((d) => [d.name.split("/").pop(), Object.fromEntries(Object.entries(d.fields).filter(([k]) => k !== "rentals").map(([k, v]) => [k, val(v)]))])));
localStorage.mm_me = JSON.stringify({ uid: "me", name: "탐정", photo: "", member: true });

// 2) 가져오기 모달을 열고 CSV를 넣는다
window.prompt = () => "탐정"; window.confirm = () => true;
[...document.querySelectorAll("button")].find((b) => b.textContent.includes("CSV 가져오기")).click();
const text = await (await fetch("/murder_mystery_games.csv")).text();
const input = document.querySelector('dialog input[type="file"]');
const dt = new DataTransfer(); dt.items.add(new File([text], "games.csv", { type: "text/csv" }));
input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
```

   요약이 `preview.mjs`와 같은지, 등록 후 게임 수가 늘고 다시 열면 그 게임들이 "이미 있음"으로 가는지, 콘솔 오류가 없는지 본다. 게임 수정 화면에서 연도만 있는 출시일이 보이는지도 본다.

## 6. 실제 사이트에 반영 (사용자가 원할 때)

순서가 중요하다. 기능이 배포되지 않으면 사이트에 버튼이 없고, 등록한 뒤 다시 배포해야 새 게임의 정적 페이지·sitemap이 생긴다.

1. **기능 배포**: `firebase deploy --only hosting`(샌드박스 밖, predeploy가 `npm run build`를 돌림). 빌드 로그에 `게임 N개를 ... 만들어요`가 찍히는지 본다. 규칙은 바뀌지 않았으니 firestore 배포는 필요 없다.
2. **Claude in Chrome으로 등록** (사용자의 Chrome에는 사이트 회원 계정이 로그인되어 있다. 로그인 화면이 나오면 사용자에게 로그인을 부탁한다. 비밀번호를 대신 넣지 않는다):
   - `https://mahamuder.web.app/games`를 연다. 배포 직후라 예전 화면이 캐시돼 있으면 새로 고침한다. "CSV 가져오기" 버튼이 보이는지 확인.
   - 버튼을 눌러 모달을 열고, `file_upload` 도구로 `dialog input[type="file"]`에 저장소의 `murder_mystery_games.csv` 절대 경로를 올린다.
   - 요약 숫자가 `preview.mjs`와 같은지 확인한다. 비슷한 이름은 기본으로 체크 해제 상태 그대로 둔다(같은 게임의 시리즈 표기 차이가 대부분). 사용자가 따로 고르라고 한 것만 체크한다.
   - `선택한 N개 등록` → 확인창(`confirm`)을 수락. 확인창이 자동화를 멈추면 먼저 JS로 `window.confirm = () => true`를 넣는다. 사용자가 이 등록을 요청했다는 것이 이 클릭의 허락이다. 요청이 분명하지 않으면 숫자를 보여 주고 먼저 묻는다.
   - "N개 등록했어요" 토스트와, 다시 열었을 때 새 게임 0개인지 확인한다. 공개 REST로 게임 수가 늘었는지도 본다.
3. **정적 페이지 배포**: `firebase deploy --only hosting`을 한 번 더 한다. 빌드 로그의 게임 수가 늘었는지 본다.
4. 보고: 등록한 수, 남겨 둔 "비슷한 이름" 목록(같은 게임인지 사용자가 판단할 것), 영문명으로 못 잡은 중복 의심(예: 분가 / 불타는 저택). 잘못 들어간 게임은 등록한 회원이 상세 화면에서 지울 수 있다.

커밋은 사용자가 원할 때만 한다. 커밋하면 파일을 지정해서 추가한다(루트의 mp4가 섞이지 않게).
