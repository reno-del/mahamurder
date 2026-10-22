"""환경 변수 읽기.

chatbot/.env를 먼저 읽고, 거기 없는 값은 저장소 루트 .env(OPENAI_API_KEY 등)에서 채운다.
load_dotenv는 이미 있는 값을 덮어쓰지 않으므로 우선순위는 셸 환경 변수 > chatbot/.env > 루트 .env.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")
load_dotenv(HERE.parent / ".env")

OPENAI_MODEL = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"


def require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name}가 비어 있어요. chatbot/.env 또는 저장소 루트 .env에 넣어 주세요.")
    return value
