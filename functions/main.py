"""사이트의 챗봇 창이 부르는 API (Firebase Functions, Python).

POST /api/chat  {"question": "..."}  + Authorization: Bearer <Firebase ID 토큰>
→ {"answer", "conditions", "sources": [{"title", "url", "score"}]}

검색·답변 코드는 chatbot/에 있는 것을 그대로 쓴다. 배포 전에 predeploy(scripts/sync-chatbot.mjs)가
chatbot/chat.py와 chatbot/rag/를 이 폴더로 복사한다. 비용이 드는 API라 회원(users/{uid} 문서가 있는 사람)만 쓸 수 있다.
"""

import os

from firebase_admin import auth, firestore, initialize_app
from firebase_functions import https_fn, options
from firebase_functions.params import SecretParam

SECRETS = [SecretParam(n) for n in
           ("OPENAI_API_KEY", "UPSTAGE_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")]
MAX_QUESTION = 500

initialize_app()
_bot = None


def bot():
    """첫 요청에서 한 번만 만든다(콜드 스타트 때 import가 무거움)."""
    global _bot
    if _bot is None:
        from langchain_core.output_parsers import StrOutputParser
        from langchain_openai import ChatOpenAI

        from chat import PROMPT
        from rag.filters import filter_extractor
        from rag.store import vector_store

        model = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
        llm = ChatOpenAI(model=model, temperature=0.2)
        # model_copy는 temperature를 못 바꾸는 모델에서 오류가 나므로 새로 만든다(chat.py와 같음).
        extractor = filter_extractor(ChatOpenAI(model=model, temperature=0))
        _bot = (vector_store(), PROMPT | llm | StrOutputParser(), extractor)
    return _bot


def answer(question: str) -> dict:
    from chat import format_context
    from rag.store import TOP_K, search

    store, chain, extractor = bot()
    game_filter = extractor.invoke({"question": question})
    conditions = game_filter.describe() if game_filter else ""
    hits = search(store, question, TOP_K, game_filter)
    if not hits:
        text = (f"조건({conditions})에 맞는 게임을 사이트 자료에서 찾지 못했어요." if conditions
                else "아직 챗봇 자료가 준비되지 않았어요.")
        return {"answer": text, "conditions": conditions, "sources": []}
    asked = f"{question}\n(검색 조건 {conditions}에 맞는 게임만 근거로 골랐어)" if conditions else question
    return {
        "answer": chain.invoke({"context": format_context(hits), "question": asked}),
        "conditions": conditions,
        "sources": [{"title": d.metadata["title"], "url": d.metadata["url"], "score": round(s, 4)}
                    for d, s in hits],
    }


def is_member(req: https_fn.Request) -> bool:
    if os.getenv("FUNCTIONS_EMULATOR") == "true":
        return True  # 로컬 에뮬레이터(데모 모드 테스트)에서는 로그인 검사를 건너뛴다
    header = req.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return False
    try:
        uid = auth.verify_id_token(header.removeprefix("Bearer "))["uid"]
    except Exception:
        return False
    return firestore.client().document(f"users/{uid}").get().exists


@https_fn.on_request(region="asia-northeast3", secrets=SECRETS, memory=options.MemoryOption.GB_1,
                     timeout_sec=120, max_instances=3)
def chat(req: https_fn.Request) -> https_fn.Response:
    if req.method != "POST":
        return https_fn.Response("POST만 받아요.", status=405)
    if not is_member(req):
        return https_fn.Response("회원만 쓸 수 있어요.", status=403)
    question = str((req.get_json(silent=True) or {}).get("question", "")).strip()
    if not question or len(question) > MAX_QUESTION:
        return https_fn.Response(f"질문은 1~{MAX_QUESTION}자로 보내 주세요.", status=400)
    try:
        return _json(answer(question))
    except Exception as e:  # 외부 API 오류는 화면에 짧게만 알린다
        print("chat error:", repr(e))
        return https_fn.Response("답변을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.", status=502)


def _json(data: dict) -> https_fn.Response:
    import json

    return https_fn.Response(json.dumps(data, ensure_ascii=False), status=200,
                             content_type="application/json; charset=utf-8")
