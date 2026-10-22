"""문서를 청크로 자른다. 이웃한 청크는 앞 청크 끝의 10~20%를 다음 청크 앞에 다시 담는다.

RecursiveCharacterTextSplitter는 조각(문장·줄) 단위로 겹치게 하므로, 조각 하나가 겹침 길이보다 길면
겹침이 0이 된다. 그래서 띄어쓰기 단위로만 자른다. 그러면 겹침이 항상 CHUNK_OVERLAP 근처(어절 하나 차이)로 맞춰진다.
"""

import uuid

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHUNK_SIZE = 300
CHUNK_OVERLAP = 45  # CHUNK_SIZE의 15%

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=[" ", ""],
    add_start_index=True,
)


def split(docs: list[Document]) -> list[Document]:
    """청크마다 제목을 머리에 붙이고, 겹친 글자 수와 다시 넣어도 같은 id를 메타데이터에 남긴다."""
    chunks: list[Document] = []
    for doc in docs:
        parts = _splitter.split_documents([doc])
        prev_end = None
        for i, part in enumerate(parts):
            start = part.metadata.pop("start_index")
            overlap = max(0, prev_end - start) if prev_end is not None else 0
            prev_end = start + len(part.page_content)
            meta = {
                **part.metadata,
                "chunk": i,
                "chunks": len(parts),
                "overlap_chars": overlap,
            }
            # 이어지는 청크도 어떤 문서의 일부인지 알 수 있게 제목을 붙인다(게임 문서는 첫 줄이 이미 제목).
            header = "" if doc.metadata["source"] == "game" and i == 0 else f"[{doc.metadata['title']}]\n"
            chunks.append(Document(page_content=header + part.page_content, metadata=meta))
    return chunks


def chunk_id(doc: Document) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc.metadata['url']}|{doc.metadata['title']}|{doc.metadata['chunk']}"))


def overlap_report(chunks: list[Document]) -> dict:
    """이웃한 청크 쌍마다 '앞 청크 길이 대비 겹친 비율'을 잰다."""
    ratios = []
    by_doc: dict[str, list[Document]] = {}
    for c in chunks:
        by_doc.setdefault(f"{c.metadata['url']}|{c.metadata['title']}", []).append(c)
    for parts in by_doc.values():
        for prev, cur in zip(parts, parts[1:]):
            body = prev.page_content.split("\n", 1)[1] if prev.page_content.startswith("[") else prev.page_content
            ratios.append(cur.metadata["overlap_chars"] / len(body))
    return {
        "pairs": len(ratios),
        "min": min(ratios, default=0),
        "max": max(ratios, default=0),
        "avg": sum(ratios) / len(ratios) if ratios else 0,
        "outside_10_20": sum(1 for r in ratios if not 0.10 <= r <= 0.20),
    }
