import { useGameHelpers, type Copy } from "../state/AppContext";
import type { Game } from "../types";

const CUSTOM = "__custom";

/** 게임 한 벌을 교회 어디에 두었는지 보여 주고 바로 고칠 수 있는 선택 칸 */
export function StoragePicker({ game, copy }: { game: Game; copy: Copy }) {
  const { storagePlaces, setStorage } = useGameHelpers();
  const places = storagePlaces();

  const onChange = (v: string) => {
    if (v === CUSTOM) {
      const p = prompt("게임을 둔 곳을 적어 주세요 (예: 본관 2층 창고)", copy.place || "")?.trim().slice(0, 30);
      if (p) setStorage(game, copy.owner, p);
      return;
    }
    setStorage(game, copy.owner, v || null);
  };

  return (
    <select
      className="input storage-select"
      aria-label={`${copy.owner.name} 게임 보관 위치`}
      value={copy.place || ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">📍 위치 미정</option>
      {places.map((p) => (
        <option key={p} value={p}>
          📍 {p}
        </option>
      ))}
      <option value={CUSTOM}>직접 입력…</option>
    </select>
  );
}
