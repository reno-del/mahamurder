import type { FormEvent } from "react";
import { store } from "../../store";
import { useModal } from "../../components/Modal";
import { useApp } from "../../state/AppContext";
import { showError, toast } from "../../lib/toast";
import { CATEGORIES, categoryOf } from "../../lib/category";
import type { Category, Game, GameInput } from "../../types";

const DIFFICULTIES = ["", "쉬움", "보통", "어려움"];

export function GameForm({ game }: { game?: Game }) {
  const { user } = useApp();
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
      // 장르 태그(genres)는 화면에서 다루지 않는다. 수정할 때는 merge라 기존 태그가 그대로 남는다
      category: (f.category as Category) || null,
      imageUrl: f.imageUrl.trim(),
      link: f.link.trim(),
      description: f.description.trim(),
      localized: f.localized === "yes",
      // 등록자는 처음 추가할 때만 남긴다 (수정할 때는 merge로 기존 값 유지)
      ...(!g.id && user && { createdBy: user.uid }),
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
          {/* 보드라이프에서 옮긴 게임은 연도만("2018") 있다. date 입력은 이 값을 못 보여 주고 저장할 때 지워 버리므로 텍스트 칸으로 둔다 */}
          {/^\d{4}$/.test(v(g.releaseDate)) ? (
            <input className="input" name="releaseDate" pattern="\d{4}(-\d{2}-\d{2})?" placeholder="YYYY 또는 YYYY-MM-DD" defaultValue={v(g.releaseDate)} />
          ) : (
            <input className="input" name="releaseDate" type="date" defaultValue={v(g.releaseDate)} />
          )}
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
        <fieldset className="full category-radio">
          <legend>분류</legend>
          {CATEGORIES.map((c) => (
            <label key={c.id}>
              <input type="radio" name="category" value={c.id} defaultChecked={categoryOf(g) === c.id} />
              {c.name} <span className="muted small">({c.hint})</span>
            </label>
          ))}
        </fieldset>
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
