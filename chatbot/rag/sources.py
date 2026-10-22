"""챗봇이 참고할 원문 문서를 모은다.

- 게임: Firestore 공개 REST(누구나 읽을 수 있는 games 컬렉션). 원문 링크는 /games/<id>.
- 사이트 소개·FAQ: 첫 화면에 들어 있는 JSON-LD(WebSite, FAQPage).
- 기능 안내: data/guides.json (사이트를 직접 써 보며 정리한 사용법).

createdBy(회원 uid), rentals(대여자 이름) 같은 개인 정보는 넣지 않는다.
"""

import json
import re
from pathlib import Path

import requests
from langchain_core.documents import Document

SITE_URL = "https://mahamuder.web.app"
GAMES_API = (
    "https://firestore.googleapis.com/v1/projects/mahamuder/databases/(default)/documents/games"
)
GUIDES_PATH = Path(__file__).resolve().parent.parent / "data" / "guides.json"


def _value(v: dict):
    """Firestore REST 값 {"stringValue": ...}를 파이썬 값으로 바꾼다."""
    if "stringValue" in v:
        return v["stringValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return float(v["doubleValue"])
    if "booleanValue" in v:
        return v["booleanValue"]
    if "arrayValue" in v:
        return [_value(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: _value(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None


def fetch_games() -> list[dict]:
    games, token = [], None
    while True:
        params = {"pageSize": 300}
        if token:
            params["pageToken"] = token
        res = requests.get(GAMES_API, params=params, timeout=30)
        res.raise_for_status()
        body = res.json()
        for doc in body.get("documents", []):
            game = {k: _value(v) for k, v in doc.get("fields", {}).items()}
            game["id"] = doc["name"].rsplit("/", 1)[-1]
            games.append(game)
        token = body.get("nextPageToken")
        if not token:
            return games


def _players(g: dict) -> str | None:
    lo, hi = g.get("minPlayers"), g.get("maxPlayers")
    if not lo and not hi:
        return None
    if lo and hi and lo != hi:
        return f"{lo}~{hi}명"
    return f"{lo or hi}명"


def game_text(g: dict) -> str:
    lines = [f"게임: {g.get('name', '').strip()}"]
    desc_lines = [
        line.strip()
        for line in (g.get("description") or "").splitlines()
        # "디자이너: -" 같은 빈 자리표시 줄은 뺀다
        if line.strip() and not re.search(r":\s*-\s*$", line)
    ]
    english = [l for l in desc_lines if l.startswith("영문명:")]
    lines += english
    if g.get("publisher"):
        lines.append(f"제작사: {g['publisher']}")
    if g.get("genres"):
        lines.append(f"장르: {', '.join(g['genres'])}")

    facts = []
    if players := _players(g):
        facts.append(f"인원 {players}")
    if g.get("playTime"):
        facts.append(f"플레이 시간 {g['playTime']}분")
    if g.get("difficulty"):
        facts.append(f"난이도 {g['difficulty']}")
    if year := (g.get("releaseDate") or "")[:4]:
        facts.append(f"{year}년 출시")
    facts.append("미정발(한국어판 없음)" if g.get("localized") is False else "정발")
    lines.append(" / ".join(facts))

    if g.get("price"):
        lines.append(f"가격: {g['price']:,}원")
    if g.get("rating"):
        lines.append(f"외부 평가: {g['rating']} / 5")
    lines += [l for l in desc_lines if l not in english]
    # 구매 링크(link)는 임베딩에 잡음만 되므로 본문이 아니라 메타데이터에 둔다.
    return "\n".join(lines)


def game_documents() -> list[Document]:
    docs = []
    for g in fetch_games():
        docs.append(
            Document(
                page_content=game_text(g),
                metadata={
                    "source": "game",
                    "title": g.get("name", ""),
                    "url": f"{SITE_URL}/games/{g['id']}",
                    "game_id": g["id"],
                    "publisher": g.get("publisher"),
                    "genres": g.get("genres") or [],
                    "min_players": g.get("minPlayers"),
                    "max_players": g.get("maxPlayers"),
                    "play_time": g.get("playTime"),
                    "difficulty": g.get("difficulty") or None,
                    "localized": g.get("localized") is not False,
                    "purchase_link": g.get("link") or None,
                },
            )
        )
    return docs


def site_documents() -> list[Document]:
    """첫 화면의 JSON-LD에서 사이트 소개와 FAQ를 꺼낸다."""
    html = requests.get(f"{SITE_URL}/", timeout=30).text
    docs = []
    for block in re.findall(
        r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, flags=re.S
    ):
        data = json.loads(block)
        for node in data.get("@graph", [data]):
            kind = node.get("@type")
            if kind == "WebSite" and node.get("description"):
                docs.append(
                    Document(
                        page_content=f"{node.get('name', '')}: {node['description']}",
                        metadata={"source": "site", "title": "사이트 소개", "url": f"{SITE_URL}/"},
                    )
                )
            elif kind == "FAQPage":
                for qa in node.get("mainEntity", []):
                    q = qa["name"]
                    a = qa["acceptedAnswer"]["text"]
                    docs.append(
                        Document(
                            page_content=f"Q: {q}\nA: {a}",
                            metadata={"source": "faq", "title": f"FAQ: {q}", "url": f"{SITE_URL}/"},
                        )
                    )
    return docs


def guide_documents() -> list[Document]:
    guides = json.loads(GUIDES_PATH.read_text(encoding="utf-8"))
    return [
        Document(
            page_content=g["text"],
            metadata={"source": "guide", "title": f"사용법: {g['title']}", "url": SITE_URL + g["path"]},
        )
        for g in guides
    ]


def load_all() -> list[Document]:
    return site_documents() + guide_documents() + game_documents()
