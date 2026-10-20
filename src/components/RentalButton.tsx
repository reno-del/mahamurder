import { useApp, useGameHelpers, type Copy } from "../state/AppContext";
import type { Game } from "../types";

/** 게임 한 벌에 대한 대여/반납 버튼. 내 게임이 대여 중이 아니면 아무것도 그리지 않는다 */
export function RentalButton({ game, copy }: { game: Game; copy: Copy }) {
  const { user } = useApp();
  const { rentGame, returnGame } = useGameHelpers();
  const isMyCopy = copy.owner.id === user?.uid;

  if (copy.rental) {
    const borrowedByMe = copy.rental.uid === user?.uid;
    return (
      <button className="btn btn-sm" onClick={() => returnGame(game, copy.owner)}>
        {borrowedByMe ? "반납하기" : isMyCopy ? "돌려받음" : "반납 처리"}
      </button>
    );
  }
  if (isMyCopy) return null;
  return (
    <button className="btn btn-primary btn-sm" onClick={() => rentGame(game, copy.owner)}>
      대여하기
    </button>
  );
}
