"""머더미스터리 클럽 챗봇 웹 화면 (Streamlit).

    .venv\\Scripts\\streamlit run app.py --server.port 8501
"""

import os

import streamlit as st
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI

from chat import PROMPT, format_context
from rag.filters import filter_extractor
from rag.store import TOP_K, _require, search, vector_store

st.set_page_config(page_title="머더미스터리 클럽 챗봇", page_icon="🕵️")


@st.cache_resource
def setup():
    llm = ChatOpenAI(model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"), temperature=0.2,
                     api_key=_require("OPENAI_API_KEY"))
    # model_copy는 검증을 건너뛰어 temperature를 못 바꾸는 모델(gpt-5 등)에서 오류가 나므로 새로 만든다(chat.py와 같음).
    extractor = filter_extractor(ChatOpenAI(model=llm.model_name, temperature=0, api_key=_require("OPENAI_API_KEY")))
    return vector_store(), PROMPT | llm | StrOutputParser(), extractor


def ask(question: str) -> dict:
    store, chain, extractor = setup()
    game_filter = extractor.invoke({"question": question})
    conditions = game_filter.describe() if game_filter else ""
    hits = search(store, question, TOP_K, game_filter)
    if not hits:
        text = (f"조건({conditions})에 맞는 게임을 사이트 자료에서 찾지 못했어요." if conditions
                else "벡터 DB가 비어 있어요. 먼저 python ingest.py를 실행해 주세요.")
        return {"text": text, "conditions": conditions, "sources": []}
    asked = f"{question}\n(검색 조건 {conditions}에 맞는 게임만 근거로 골랐어)" if conditions else question
    text = chain.invoke({"context": format_context(hits), "question": asked})
    sources = [{"title": d.metadata["title"], "url": d.metadata["url"], "score": s} for d, s in hits]
    return {"text": text, "conditions": conditions, "sources": sources}


def md(text: str) -> str:
    """Streamlit 마크다운은 ~를 취소선으로 읽어 '1~8명'이 '18명'처럼 보이므로 ~를 그대로 보이게 한다."""
    return text.replace("~", r"\~")


def show(msg: dict) -> None:
    st.markdown(md(msg["text"]))
    if msg.get("conditions"):
        st.caption(f"적용한 조건: {msg['conditions']}")
    if msg.get("sources"):
        scores = [s["score"] for s in msg["sources"]]
        with st.expander(f"참고한 원문 · 최고 유사도 {max(scores):.4f} · 평균 {sum(scores) / len(scores):.4f}"):
            for i, s in enumerate(msg["sources"], 1):
                st.markdown(f"**[{i}]** 유사도 `{s['score']:.4f}` · [{md(s['title'])}]({s['url']})")


st.title("🕵️ 머더미스터리 클럽 챗봇")
st.caption("Upstage 임베딩으로 사이트 내용 중 코사인 유사도 상위 5개를 찾아, OpenAI 모델이 답해요.")

if "messages" not in st.session_state:
    st.session_state.messages = []

for m in st.session_state.messages:
    with st.chat_message(m["role"]):
        show(m) if m["role"] == "assistant" else st.markdown(md(m["text"]))

if question := st.chat_input("예: 5명이서 할 만한 게임 추천해 줘"):
    st.session_state.messages.append({"role": "user", "text": question})
    with st.chat_message("user"):
        st.markdown(md(question))
    with st.chat_message("assistant"):
        with st.spinner("찾는 중..."):
            msg = {"role": "assistant", **ask(question)}
        show(msg)
    st.session_state.messages.append(msg)
