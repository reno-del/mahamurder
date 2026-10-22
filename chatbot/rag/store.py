"""Upstage 임베딩 + Supabase(pgvector) 벡터 저장소."""

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_core.documents import Document
from langchain_upstage import UpstageEmbeddings
from supabase import create_client

from rag.filters import GameFilter

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

TABLE = "mm_documents"
MATCH_FN = "match_mm_documents"
TOP_K = 5


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name}가 비어 있어요. chatbot/.env에 넣어 주세요(.env.example 참고).")
    return value


def embeddings() -> UpstageEmbeddings:
    # 문서는 embedding-passage, 질문은 embedding-query로 자동으로 나뉘어 임베딩된다.
    return UpstageEmbeddings(model=os.getenv("UPSTAGE_EMBEDDING_MODEL", "embedding"),
                             api_key=_require("UPSTAGE_API_KEY"))


def vector_store() -> SupabaseVectorStore:
    # 대시보드에서 REST 주소(https://xxx.supabase.co/rest/v1/)를 복사해 와도 되게 뒤쪽 경로는 뗀다.
    url = _require("SUPABASE_URL").rstrip("/").removesuffix("/rest/v1")
    client = create_client(url, _require("SUPABASE_SERVICE_ROLE_KEY"))
    # 4096차원 벡터는 한 줄이 80KB쯤 되므로 한 번에 50줄씩 올린다.
    return SupabaseVectorStore(client=client, embedding=embeddings(), table_name=TABLE,
                               query_name=MATCH_FN, chunk_size=50)


def search(store: SupabaseVectorStore, question: str, k: int = TOP_K,
           game_filter: GameFilter | None = None) -> list[tuple[Document, float]]:
    """질문과 코사인 유사도가 가장 높은 k개 청크를 (문서, 유사도) 순서로 돌려준다.

    game_filter가 있으면 그 조건에 맞는 게임만 남긴 뒤 상위 k개를 고른다.
    """
    # SupabaseVectorStore의 postgrest_filter는 지금 설치된 supabase 라이브러리와 맞지 않아(.params 없음)
    # 매칭 함수를 직접 부르고 조건은 Supabase 클라이언트의 filter로 잇는다. 조건은 상위 k개를 자르기 전에 적용된다.
    params: dict = {"query_embedding": store.embeddings.embed_query(question)}
    numbers: list[tuple[str, str, str]] = []
    if game_filter is not None and not game_filter.is_empty():
        params["filter"] = game_filter.match_filter()
        numbers = game_filter.number_filters()
    query = store._client.rpc(MATCH_FN, params)
    for column, op, value in numbers:
        query = query.filter(column, op, value)
    rows = query.limit(k).execute().data
    hits = [(Document(page_content=r["content"], metadata=r["metadata"]), r["similarity"]) for r in rows]
    return sorted(hits, key=lambda h: h[1], reverse=True)
