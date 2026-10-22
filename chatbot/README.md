# 머더미스터리 클럽 RAG 챗봇

https://mahamuder.web.app 의 내용에 답하는 챗봇입니다. 질문과 **코사인 유사도가 가장 높은 청크 5개**를 근거로 답하고, 답변 아래에 각 근거의 유사도와 원문 링크를 붙입니다.

| 단계 | 사용 기술 |
| --- | --- |
| 답변 생성 | OpenAI (`OPENAI_MODEL`, 기본 `gpt-4o-mini`) + LangChain |
| 임베딩 | Upstage `embedding-passage`(문서) / `embedding-query`(질문), 4096차원 |
| 벡터 DB | Supabase pgvector: 테이블 `mm_documents`, 함수 `match_mm_documents` (유사도 = `1 - (embedding <=> 질문)`) |
| 파이썬 | pyenv 3.11.9 (`.python-version`) + 이 폴더의 `.venv` |

## 무엇을 넣나

- 게임 667개: Firestore 공개 REST. 원문 링크 `https://mahamuder.web.app/games/<id>`
- 사이트 소개와 FAQ 6개: 첫 화면의 JSON-LD
- 기능 사용법 18개: `data/guides.json` (여러 에이전트가 방문자·회원 입장에서 사이트를 써 보며 정리)

회원 uid(`createdBy`), 대여 기록(`rentals`), 플레이 기록 같은 개인 정보는 넣지 않습니다. 그래서 "누가 해 봤는지" 같은 질문에는 로그인해서 확인하라고 안내합니다.

## 청크

`RecursiveCharacterTextSplitter`로 300자씩 자르고 45자(15%)를 겹칩니다. 겹침이 0이 되지 않도록 띄어쓰기 단위로만 자르고, 이어지는 청크에는 `[문서 제목]`을 붙입니다. `python ingest.py --dry-run`을 실행하면 이웃한 청크마다 실제로 얼마나 겹쳤는지 보여 줍니다. 지금 데이터에서는 13쌍이 모두 12~15%입니다. 게임 정보는 대부분 300자보다 짧아서 한 청크에 들어갑니다.

## 처음 설정

```powershell
cd chatbot
pyenv install 3.11.9        # 이미 있으면 건너뜀
& "$env:USERPROFILE\.pyenv\pyenv-win\versions\3.11.9\python.exe" -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env # 키 네 개를 채움
```

1. Supabase 대시보드의 SQL Editor에서 `supabase/schema.sql`을 실행합니다.
2. `.\.venv\Scripts\python.exe ingest.py`를 실행해 임베딩을 넣습니다. 게임을 추가했으면 다시 실행하세요(표를 비우고 전체를 다시 넣음).
3. 다음 명령으로 대화합니다.

```powershell
.\.venv\Scripts\python.exe chat.py
.\.venv\Scripts\python.exe chat.py "5명이서 2시간 안에 끝나는 게임 추천해 줘"
```

## 답변 예시 형식

```
5명이서 할 수 있는 게임으로는 ... [1][3]

── 참고한 원문 (코사인 유사도 상위 5개) ──
[1] 유사도 0.xxxx | 눈이 멈추기 전에 | https://mahamuder.web.app/games/0L2LQVC9iGnxanVfqz6Y
...
최고 유사도 0.xxxx · 평균 유사도 0.xxxx
```

## 알아 둘 점

- 4096차원은 pgvector 인덱스(최대 2000차원)를 쓸 수 없어서 전체를 정확히 비교합니다. 문서가 700개 정도라 느리지 않습니다.
- 임베딩 검색은 "5명", "120분" 같은 숫자 조건을 정확히 거르지 못합니다. 인원·시간은 메타데이터(`min_players`, `max_players`, `play_time`)에도 들어 있으니, 정확한 필터가 필요하면 그 값으로 거르는 단계를 더하면 됩니다.
