"""Upstage 임베딩 + Supabase(pgvector) 벡터 저장소."""

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_core.documents import Document
from langchain_upstage import UpstageEmbeddings
from supabase import create_client

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


def search(store: SupabaseVectorStore, question: str, k: int = TOP_K) -> list[tuple[Document, float]]:
    """질문과 코사인 유사도가 가장 높은 k개 청크를 (문서, 유사도) 순서로 돌려준다."""
    hits = store.similarity_search_with_relevance_scores(question, k=k)
    return sorted(hits, key=lambda h: h[1], reverse=True)
