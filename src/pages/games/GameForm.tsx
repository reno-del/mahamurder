import type { FormEvent } from "react";
import { store } from "../../store";
import { useModal } from "../../components/Modal";
import { showError, toast } from "../../lib/toast";
import type { Game, GameInput } from "../../types";

const DIFFICULTIES = ["", "쉬움", "보통", "어려움"];

export function GameForm({ game }: { game?: Game }) {
  const { closeModal } = useModal();
  const g: Partial<Game> = game || {};
  const v = (x: unknown) => (x ?? "") as string;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const num = (s: string) => (s === "" ? null : Number(s));
    const data: GameInput = {
      id: g.id,
      name: f.name.trim(),
      publisher: f.publisher.trim(),
      price: num(f.price),
      releaseDate: f.releaseDate,
      rating: num(f.rating),
      minPlayers: num(f.minPlayers),
      maxPlayers: num(f.maxPlayers) ?? num(f.minPlayers),
      playTime: num(f.playTime),
      difficulty: f.difficulty,
      genres: f.genres
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      imageUrl: f.imageUrl.trim(),
      link: f.link.trim(),
      description: f.description.trim(),
      localized: f.localized === "yes",
    };
    try {
      await store.saveGame(data);
      closeModal();
      toast("저장했어요");
    } catch (err) {
      showError(err);
    }
  };

  return (
    <>
      <h2>{g.id ? "게임 정보 수정" : "새 게임 추가"}</h2>
      <form className="form" onSubmit={onSubmit}>
        <label className="full">
          게임 이름 *<input className="input" name="name" required defaultValue={v(g.name)} />
        </label>
        <label>
          제작사 / 출판사
          <input className="input" name="publisher" defaultValue={v(g.publisher)} />
        </label>
        <label>
          가격 (원)
          <input className="input" name="price" type="number" min="0" step="100" defaultValue={v(g.price)} />
        </label>
        <label>
          출시일
          <input className="input" name="releaseDate" type="date" defaultValue={v(g.releaseDate)} />
        </label>
        <label>
          평가 (0~5)
          <input className="input" name="rating" type="number" min="0" max="5" step="0.1" defaultValue={v(g.rating)} />
        </label>
        <label>
          최소 인원
          <input className="input" name="minPlayers" type="number" min="1" defaultValue={v(g.minPlayers)} />
        </label>
        <label>
          최대 인원
          <input className="input" name="maxPlayers" type="number" min="1" defaultValue={v(g.maxPlayers)} />
        </label>
        <label>
          플레이 시간 (분)
          <input className="input" name="playTime" type="number" min="0" step="10" defaultValue={v(g.playTime)} />
        </label>
        <label>
          난이도
          <select className="input" name="difficulty" defaultValue={g.difficulty || ""}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          정발 여부
          <select className="input" name="localized" defaultValue={g.localized === false ? "no" : "yes"}>
            <option value="yes">정발됨</option>
            <option value="no">미정발</option>
          </select>
        </label>
        <label className="full">
          장르 (쉼표로 구분)
          <input
            className="input"
            name="genres"
            placeholder="클로즈드 서클, 추리, 감성"
            defaultValue={(g.genres || []).join(", ")}
          />
        </label>
        <label className="full">
          이미지 URL
          <input className="input" name="imageUrl" type="url" defaultValue={v(g.imageUrl)} />
        </label>
        <label className="full">
          구매/상세 링크
          <input className="input" name="link" type="url" defaultValue={v(g.link)} />
        </label>
        <label className="full">
          소개 (스포일러 주의!)
          <textarea className="input" name="description" rows={4} defaultValue={v(g.description)} />
        </label>
        <div className="form-actions full">
          <button type="button" className="btn btn-ghost" data-close>
            취소
          </button>
          <button className="btn btn-primary">저장</button>
        </div>
      </form>
    </>
  );
}
