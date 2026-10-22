"""사이트 내용을 모아 청크로 자르고, Upstage로 임베딩해 Supabase에 다시 채운다.

    python ingest.py --dry-run   # 키 없이: 문서 수, 청크 겹침 비율, 예시 청크만 확인
    python ingest.py             # 테이블을 비우고 전체를 다시 넣음
"""

import argparse
import sys

from rag.chunking import CHUNK_OVERLAP, CHUNK_SIZE, chunk_id, overlap_report, split
from rag.sources import load_all

sys.stdout.reconfigure(encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="임베딩·업로드 없이 청크만 확인")
    args = parser.parse_args()

    docs = load_all()
    chunks = split(docs)
    counts: dict[str, int] = {}
    for d in docs:
        counts[d.metadata["source"]] = counts.get(d.metadata["source"], 0) + 1
    print(f"원문 문서 {len(docs)}개 {counts} → 청크 {len(chunks)}개 "
          f"(chunk_size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP})")

    rep = overlap_report(chunks)
    print(f"이웃 청크 {rep['pairs']}쌍의 겹침 비율: 최소 {rep['min']:.1%}, 평균 {rep['avg']:.1%}, "
          f"최대 {rep['max']:.1%}, 10~20% 밖 {rep['outside_10_20']}쌍")

    if args.dry_run:
        split_doc = next((c for c in chunks if c.metadata["chunks"] > 1), None)
        samples = [chunks[0], *(c for c in chunks if c.metadata["source"] == "game")][:2]
        if split_doc:
            samples += [c for c in chunks if c.metadata["title"] == split_doc.metadata["title"]]
        for c in samples:
            print("\n---", c.metadata["title"], c.metadata["url"],
                  f"chunk {c.metadata['chunk'] + 1}/{c.metadata['chunks']}, 겹침 {c.metadata['overlap_chars']}자")
            print(c.page_content)
        return

    from rag.store import TABLE, vector_store

    store = vector_store()
    # 지워진 게임이 남지 않도록 비우고 다시 넣는다.
    # 한 번에 지우면서 4096차원 벡터를 돌려받으면 시간 초과가 나므로, id만 읽어 조금씩 지우고 결과는 받지 않는다.
    table = store._client.table(TABLE)
    while old := [r["id"] for r in table.select("id").limit(100).execute().data]:
        table.delete(returning="minimal").in_("id", old).execute()
    ids = store.add_documents(chunks, ids=[chunk_id(c) for c in chunks])
    print(f"Supabase {TABLE}에 {len(ids)}개 청크를 넣었어요.")


if __name__ == "__main__":
    main()
