import { useState, type ReactNode } from "react";
import { Cover } from "./Cover";
import type { Game } from "../types";

const PAGE = 24;

/**
 * 게임을 표지 이미지와 이름으로 보여 주는 격자. 누르면 onOpen(id).
 * sub로 이름 아래 한 줄(인원·보유자 등)을 넣는다. 게임이 많으면 PAGE개씩 "더 보기"로 늘린다.
 */
export function GameTiles({
  games,
  onOpen,
  sub,
  empty = "해당하는 게임이 없어요.",
}: {
  games: Game[];
  onOpen: (id: string) => void;
  sub?: (g: Game) => ReactNode;
  empty?: string;
}) {
  const [shown, setShown] = useState(PAGE);
  if (!games.length) return <p className="muted small">{empty}</p>;
  return (
    <>
      <div className="tile-grid">
        {games.slice(0, shown).map((g) => (
          <button key={g.id} className="picker-item tile" onClick={() => onOpen(g.id)}>
            <Cover game={g} className="picker-cover" />
            <span className="picker-name">{g.name}</span>
            {sub && <span className="tile-sub">{sub(g)}</span>}
          </button>
        ))}
      </div>
      {games.length > shown && (
        <div className="tile-more">
          <button className="btn btn-sm" onClick={() => setShown(shown + PAGE)}>
            더 보기 ({games.length - shown}개 남음)
          </button>
        </div>
      )}
    </>
  );
}
