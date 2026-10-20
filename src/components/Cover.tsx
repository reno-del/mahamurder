import type { CSSProperties } from "react";
import { cleanName } from "../lib/format";
import type { Game } from "../types";

// 이미지가 없으면 이름으로 색을 정해 첫 글자를 보여준다
export function Cover({ game, className = "" }: { game: Game; className?: string }) {
  if (game.imageUrl)
    return (
      <div className={`cover ${className}`}>
        <img src={game.imageUrl} alt="" loading="lazy" />
      </div>
    );
  const hue = [...(game.name || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div className={`cover cover-blank ${className}`} style={{ "--hue": hue } as CSSProperties}>
      <span>{cleanName(game.name).slice(0, 1)}</span>
    </div>
  );
}
