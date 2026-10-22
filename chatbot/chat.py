"""머더미스터리 클럽 RAG 챗봇.

    python chat.py                     # 대화 모드 (빈 줄이나 'q'로 종료)
    python chat.py "5명이서 할 게임 추천해 줘"   # 한 번만 묻기

질문과 코사인 유사도가 가장 높은 청크 5개를 Supabase에서 가져와 OpenAI 모델에 근거로 주고,
답변 아래에 각 근거의 유사도와 원문 링크를 붙인다.
"""

import os
import sys

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from rag.filters import filter_extractor
from rag.store import TOP_K, _require, search, vector_store

sys.stdout.reconfigure(encoding="utf-8")

PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "너는 머더미스터리 게임 모임 사이트 '머더미스터리 클럽'(https://mahamuder.web.app)의 안내 챗봇이야.\n"
     "- 아래 [근거]에 있는 내용만 사용해서 한국어로 답해. 근거에 없는 사실은 지어내지 말고 '사이트 자료에서 찾지 못했어요'라고 말해.\n"
     "- 문장마다 근거 번호를 [1], [2]처럼 붙여.\n"
     "- 질문이 누가 어떤 게임을 했는지, 누가 빌렸는지 같은 회원 개인 기록을 물을 때만, 그 기록은 근거에 없으니 사이트에 로그인해서 확인하라고 안내해. 묻지 않았으면 이 안내는 하지 마.\n"
     "- 게임의 범인·결말 같은 스포일러는 말하지 마.\n\n"
     "[근거]\n{context}"),
    ("human", "{question}"),
])


def format_context(hits) -> str:
    return "\n\n".join(
        f"[{i}] {doc.metadata['title']} ({doc.metadata['url']})\n{doc.page_content}"
        for i, (doc, _) in enumerate(hits, 1)
    )


def answer(store, chain, question: str, extractor=None) -> str:
    game_filter = extractor.invoke({"question": question}) if extractor else None
    conditions = game_filter.describe() if game_filter else ""
    hits = search(store, question, TOP_K, game_filter)
    if not hits:
        if conditions:
            return f"조건({conditions})에 맞는 게임을 사이트 자료에서 찾지 못했어요."
        return "벡터 DB가 비어 있어요. 먼저 python ingest.py를 실행해 주세요."
    asked = f"{question}\n(검색 조건 {conditions}에 맞는 게임만 근거로 골랐어)" if conditions else question
    reply = chain.invoke({"context": format_context(hits), "question": asked})
    scores = [s for _, s in hits]
    lines = [reply, ""]
    if conditions:
        lines.append(f"적용한 조건: {conditions} (조건에 맞는 게임 중에서 골랐어요)")
    lines.append(f"── 참고한 원문 (코사인 유사도 상위 {len(hits)}개) ──")
    for i, (doc, score) in enumerate(hits, 1):
        lines.append(f"[{i}] 유사도 {score:.4f} | {doc.metadata['title']} | {doc.metadata['url']}")
    lines.append(f"최고 유사도 {max(scores):.4f} · 평균 유사도 {sum(scores) / len(scores):.4f}")
    return "\n".join(lines)


def main() -> None:
    store = vector_store()
    llm = ChatOpenAI(model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"), temperature=0.2,
                     api_key=_require("OPENAI_API_KEY"))
    chain = PROMPT | llm | StrOutputParser()
    # model_copy는 검증을 다시 하지 않아, gpt-5처럼 temperature를 못 바꾸는 모델에서도 값이 그대로 넘어가 오류가 난다.
    # 새로 만들면 langchain-openai가 그런 모델에서는 temperature를 알아서 뺀다.
    extractor = filter_extractor(ChatOpenAI(model=llm.model_name, temperature=0, api_key=_require("OPENAI_API_KEY")))

    if len(sys.argv) > 1:
        print(answer(store, chain, " ".join(sys.argv[1:]), extractor))
        return
    print("머더미스터리 클럽 챗봇이에요. 궁금한 걸 물어보세요. (종료: 빈 줄 또는 q)")
    while True:
        question = input("\n질문> ").strip()
        if question in ("", "q", "quit", "exit"):
            break
        print(answer(store, chain, question, extractor))


if __name__ == "__main__":
    main()
