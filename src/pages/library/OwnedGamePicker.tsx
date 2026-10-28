import { useState } from "react";
import { useApp, useGameHelpers } from "../../state/AppContext";
import { Cover } from "../../components/Cover";
import { cleanName } from "../../lib/format";
import { categoryName, categoryOf } from "../../lib/category";
import type { Game } from "../../types";

type Show = "all" | "owned" | "notOwned";

/**
 * 보유 게임을 이미지와 이름으로 골라 추가/해제하는 창.
 * ownerId가 내 uid면 내 보유 목록을, 미등록 친구 id면 그 친구의 보유 목록을 고친다.
 * 모달 안에서도 최신 상태를 보이도록 id만 받아 useApp()에서 찾는다.
 */
export function OwnedGamePicker({ ownerId }: { ownerId: string }) {
  const { user, me, games, guests } = useApp();
  const { toggleOwned, setGuestOwned } = useGameHelpers();
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("all");

  const guest = guests.find((g) => g.id === ownerId);
  const isMe = ownerId === user?.uid;
  if (!isMe && !guest) return <p className="muted">이 친구를 찾을 수 없어요.</p>;

  const owned = (isMe ? me?.owned : guest?.owned) || {};
  const toggle = (g: Game) => (isMe ? toggleOwned(g) : setGuestOwned(guest!, g, !owned[g.id]));

  const query = q.trim().toLowerCase();
  const list = games
    .filter(
      (g) =>
        (!query || [g.name, g.publisher, categoryName(categoryOf(g))].join(" ").toLowerCase().includes(query)) &&
        (show === "all" || !!owned[g.id] === (show === "owned"))
    )
    .sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), "ko"));
  const ownedCount = games.filter((g) => owned[g.id]).length;

  return (
    <>
      <h2>{isMe ? "내 보유 게임 고르기" : `${guest!.name}님의 보유 게임 고르기`}</h2>
      <p className="muted small">게임을 누르면 보유 목록에 바로 추가되고, 다시 누르면 빠져요. 지금 {ownedCount}개 보유 중이에요.</p>
      <div className="picker-tools">
        <input
          className="input"
          type="search"
          placeholder="게임 이름, 장르, 제작사 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="seg">
          {(
            [
              ["all", "전체"],
              ["owned", "보유"],
              ["notOwned", "미보유"],
            ] as [Show, string][]
          ).map(([s, label]) => (
            <button key={s} className={show === s ? "on" : ""} onClick={() => setShow(s)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {list.length ? (
        <div className="picker-grid">
          {list.map((g) => {
            const on = !!owned[g.id];
            return (
              <button key={g.id} className={`picker-item ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(g)}>
                <Cover game={g} className="picker-cover" />
                {on && <span className="picker-check">✔</span>}
                <span className="picker-name">{g.name}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="muted small picker-empty">조건에 맞는 게임이 없어요.</p>
      )}
      <div className="form-actions">
        <button className="btn btn-primary" data-close>
          완료
        </button>
      </div>
    </>
  );
}
