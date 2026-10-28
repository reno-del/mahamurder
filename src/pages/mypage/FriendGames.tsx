import { useState } from "react";
import { useApp } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { GameTiles } from "../../components/GameTiles";
import { cleanName, displayName, players } from "../../lib/format";
import { GameDetail } from "../games/GameDetail";

type Tab = "todo" | "played" | "both";

/**
 * 친구 한 명이 해 본 게임과 안 해 본 게임을 표지와 함께 보여 주는 창.
 * "둘 다 안 해봄"은 나와 그 친구 모두 안 해 본 게임이라 같이 할 게임을 고를 때 쓴다.
 */
export function FriendGames({ profileId }: { profileId: string }) {
  const { user, me, games, profiles } = useApp();
  const { openModal } = useModal();
  const [tab, setTab] = useState<Tab>("todo");
  const friend = profiles.find((p) => p.id === profileId);
  if (!friend) return <p className="muted">이 친구를 찾을 수 없어요.</p>;

  const isMe = friend.id === user?.uid;
  const name = isMe ? "나" : `${displayName(friend) || "익명"}님`;
  const played = (id: string) => !!friend.played?.[id];
  const sorted = [...games].sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), "ko"));
  const lists: Record<Tab, typeof games> = {
    todo: sorted.filter((g) => !played(g.id)),
    played: sorted
      .filter((g) => played(g.id))
      .sort((a, b) => (friend.played![b.id].date || "").localeCompare(friend.played![a.id].date || "")),
    both: sorted.filter((g) => !played(g.id) && !me?.played?.[g.id]),
  };
  const tabs: [Tab, string][] = [
    ["todo", `안 해봄 ${lists.todo.length}`],
    ["played", `플레이함 ${lists.played.length}`],
    ...(isMe ? [] : ([["both", `둘 다 안 해봄 ${lists.both.length}`]] as [Tab, string][])),
  ];

  return (
    <>
      <h2>{name}의 게임 기록</h2>
      {friend.prefNote && <p className="muted small">좋아하는 스타일: {friend.prefNote}</p>}
      <div className="picker-tools">
        <div className="seg">
          {tabs.map(([t, label]) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <GameTiles
        key={tab}
        games={lists[tab]}
        onOpen={(id) => openModal(<GameDetail gameId={id} />)}
        sub={(g) => {
          const r = friend.played?.[g.id]?.rating;
          if (tab === "played") return r ? "★".repeat(r) : "별점 없음";
          return (
            <>
              {players(g)}
              {tab === "todo" && !isMe && me?.played?.[g.id] && <> · 나는 해봄</>}
            </>
          );
        }}
        empty={tab === "played" ? "아직 플레이 기록이 없어요." : "해당하는 게임이 없어요."}
      />
      <div className="form-actions">
        <button className="btn" data-close>
          닫기
        </button>
      </div>
    </>
  );
}
