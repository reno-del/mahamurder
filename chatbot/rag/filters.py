"""질문에서 게임 조건(정발 여부, 인원, 플레이 시간)을 뽑아 Supabase 검색 조건으로 바꾼다.

임베딩은 "5명", "2시간" 같은 숫자 조건을 거르지 못하므로, 조건이 있으면 먼저 메타데이터로 거른 뒤
남은 게임 안에서 코사인 유사도 상위 5개를 고른다.
"""

from pydantic import BaseModel, Field


class GameFilter(BaseModel):
    players: int | None = Field(
        None, description="같이 플레이할 인원 수. '5명이서', '다섯 명' → 5. 범위('7~8명')면 앞쪽 숫자.")
    max_play_time: int | None = Field(
        None, description="이 시간 안에 끝나야 하는 최대 플레이 시간(분). '2시간 안에', '1시간 이내' → 120, 60.")
    min_play_time: int | None = Field(
        None, description="최소 플레이 시간(분). '3시간 이상 긴 게임' → 180.")
    localized: bool | None = Field(
        None, description="'미정발' 게임을 찾으면 false, '정발'된 게임만 찾으면 true.")

    def is_empty(self) -> bool:
        return all(v is None for v in self.model_dump().values())

    def describe(self) -> str:
        parts = []
        if self.players is not None:
            parts.append(f"{self.players}명 가능")
        if self.min_play_time is not None:
            parts.append(f"{self.min_play_time}분 이상")
        if self.max_play_time is not None:
            parts.append(f"{self.max_play_time}분 이하")
        if self.localized is not None:
            parts.append("정발" if self.localized else "미정발")
        return " · ".join(parts)

    def match_filter(self) -> dict:
        """match_mm_documents의 filter(metadata @> filter)로 넘길 값. 조건이 있으면 게임 문서만 본다."""
        f: dict = {"source": "game"}
        if self.localized is not None:
            f["localized"] = self.localized
        return f

    def number_filters(self) -> list[tuple[str, str, str]]:
        """숫자 조건을 (열, 연산자, 값)으로. metadata->값은 jsonb라 숫자로 비교되고,
        값이 없는(JSON null) 게임은 ->>로 꺼내 SQL null인지 보고 걸러 낸다."""
        parts = []
        if self.players is not None:
            n = str(self.players)
            parts += [("metadata->min_players", "lte", n), ("metadata->max_players", "gte", n),
                      ("metadata->>min_players", "not.is", "null"), ("metadata->>max_players", "not.is", "null")]
        if self.max_play_time is not None or self.min_play_time is not None:
            parts.append(("metadata->>play_time", "not.is", "null"))
        if self.max_play_time is not None:
            parts.append(("metadata->play_time", "lte", str(self.max_play_time)))
        if self.min_play_time is not None:
            parts.append(("metadata->play_time", "gte", str(self.min_play_time)))
        return parts


EXTRACT_PROMPT = (
    "사용자가 조건에 맞는 머더미스터리 게임을 찾고 있으면 그 조건만 뽑아. "
    "특정 게임 하나의 정보를 묻거나('수상한 손님들 2는 몇 명이서 해?'), 사이트 사용법을 묻는 질문이면 모든 값을 비워 둬. "
    "질문에 없는 조건은 추측하지 마.\n\n질문: {question}"
)


def filter_extractor(llm):
    """질문 → GameFilter. llm은 ChatOpenAI."""
    from langchain_core.prompts import ChatPromptTemplate

    return ChatPromptTemplate.from_template(EXTRACT_PROMPT) | llm.with_structured_output(GameFilter)
