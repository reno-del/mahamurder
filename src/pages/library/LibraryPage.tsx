import { useState, type FormEvent } from "react";
import { store } from "../../store";
import { useApp, useGameHelpers, type Copy, type Owner } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { LoginRequired } from "../../components/Layout";
import { RentalButton } from "../../components/RentalButton";
import { showError, toast } from "../../lib/toast";
import { cleanName, displayName, players, playTime, prettyDate, ymd } from "../../lib/format";
import { GameDetail } from "../games/GameDetail";
import type { Game, Guest } from "../../types";

const byName = (a: Game, b: Game) => cleanName(a.name).localeCompare(cleanName(b.name), "ko");

// 대여일로부터 며칠째인지 (당일이면 1일째)
function daysSince(date: string) {
  const ms = new Date(ymd()).getTime() - new Date(date).getTime();
  return Math.max(0, Math.round(ms / 86400000)) + 1;
}

// 다른 페이지에 다녀와도 선택한 친구가 유지되도록 모듈에 보관 ("" = 전체)
let savedOwner = "";

interface Row extends Copy {
  game: Game;
}

function AddGuestForm() {
  const { user, guests } = useApp();
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name || !user) return;
    if (guests.some((g) => g.name === name) && !confirm(`'${name}' 이름의 미등록 친구가 이미 있어요. 그래도 추가할까요?`)) return;
    try {
      await store.createGuest(name, user.uid);
      form.reset();
      toast(`'${name}'을(를) 추가했어요`);
    } catch (err) {
      showError(err);
    }
  };
  return (
    <form className="inline-form" onSubmit={onSubmit}>
      <input className="input" name="name" maxLength={20} placeholder="가입 안 한 친구 이름" required />
      <button className="btn btn-sm">+ 미등록 친구 추가</button>
    </form>
  );
}

// 미등록 친구가 가진 게임을 목록에 추가
function AddGuestGame({ guest }: { guest: Guest }) {
  const { games } = useApp();
  const { setGuestOwned } = useGameHelpers();
  const [gameId, setGameId] = useState("");
  const options = games.filter((g) => !guest.owned?.[g.id]).sort(byName);
  if (!options.length) return null;
  const add = async () => {
    const g = games.find((x) => x.id === gameId);
    if (!g) return;
    await setGuestOwned(guest, g, true);
    setGameId("");
  };
  return (
    <div className="inline-form">
      <select className="input" value={gameId} onChange={(e) => setGameId(e.target.value)}>
        <option value="">보유 게임 추가…</option>
        {options.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <button className="btn btn-sm" disabled={!gameId} onClick={add}>
        추가
      </button>
    </div>
  );
}

export function LibraryPage() {
  const { user, games, profiles, guests } = useApp();
  const { copiesOf, setGuestOwned, deleteGuest } = useGameHelpers();
  const { openModal } = useModal();
  const [ownerFilter, setOwnerState] = useState(savedOwner);
  const setOwner = (id: string) => setOwnerState((savedOwner = id));

  if (!user) return <LoginRequired title="📦 보유 게임" message="로그인하면 친구들이 가진 게임과 대여 현황을 볼 수 있어요." />;

  const openDetail = (id: string) => openModal(<GameDetail gameId={id} />);
  const nameOf = (o: Owner) => (o.id === user.uid ? "나" : o.name);

  const rows: Row[] = [...games].sort(byName).flatMap((game) => copiesOf(game).map((c) => ({ game, ...c })));
  // 오래 빌려 간 순서대로
  const rented = rows.filter((r) => r.rental).sort((a, b) => a.rental!.date.localeCompare(b.rental!.date));
  const available = rows.filter((r) => !r.rental);
  const borrowedByMe = rented.filter((r) => r.rental!.uid === user.uid);

  // 가입한 친구는 게임이 하나라도 있을 때만(내가 먼저), 미등록 친구는 게임을 추가할 수 있도록 항상 보여 준다
  const members = profiles
    .map((p) => ({ owner: { id: p.id, name: displayName(p) || "익명" } as Owner, guest: undefined as Guest | undefined }))
    .filter((o) => rows.some((r) => r.owner.id === o.owner.id))
    .sort((a, b) => Number(b.owner.id === user.uid) - Number(a.owner.id === user.uid) || a.owner.name.localeCompare(b.owner.name, "ko"));
  const guestOwners = [...guests]
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .map((g) => ({ owner: { id: g.id, name: g.name, guest: true } as Owner, guest: g as Guest | undefined }));
  const owners = [...members, ...guestOwners].map((o) => ({ ...o, rows: rows.filter((r) => r.owner.id === o.owner.id) }));
  const shownOwners = ownerFilter ? owners.filter((o) => o.owner.id === ownerFilter) : owners;

  const gameCell = (g: Game) => (
    <td>
      <button className="link-btn" onClick={() => openDetail(g.id)}>
        {g.name}
      </button>
      {g.localized === false && <span className="badge badge-unofficial">미정발</span>}
    </td>
  );
  const ownerLabel = (o: Owner) => (
    <>
      {nameOf(o)}
      {o.guest && <span className="badge badge-unofficial">미등록</span>}
    </>
  );

  return (
    <div className="stack">
      <section className="card">
        <h1 className="section-title">📦 보유 게임</h1>
        <p className="muted small">
          친구들이 가진 게임과 지금 누가 빌려 갔는지 한눈에 볼 수 있어요. 내 게임은 게임 상세나 마이페이지에서 📦를 눌러 등록하고,
          가입하지 않은 친구의 게임은 아래에서 미등록 친구를 추가해 등록하세요.
        </p>
        <div className="stats">
          <div className="stat">
            <b>{new Set(rows.map((r) => r.game.id)).size}</b>
            <span>보유 게임</span>
          </div>
          <div className="stat">
            <b>{available.length}</b>
            <span>대여 가능</span>
          </div>
          <div className="stat">
            <b>{rented.length}</b>
            <span>대여 중</span>
          </div>
          <div className="stat">
            <b>{borrowedByMe.length}</b>
            <span>내가 빌린 게임</span>
          </div>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="card">
          <h2 className="section-title">🔑 대여 중 ({rented.length})</h2>
          {rented.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>게임</th>
                    <th>주인</th>
                    <th>빌린 사람</th>
                    <th>대여일</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rented.map((r) => {
                    const mine = r.rental!.uid === user.uid || r.owner.id === user.uid;
                    return (
                      <tr key={r.game.id + r.owner.id} className={mine ? "row-mine" : ""}>
                        {gameCell(r.game)}
                        <td>{ownerLabel(r.owner)}</td>
                        <td>{r.rental!.uid === user.uid ? <b>나</b> : r.rental!.name}</td>
                        <td>
                          {prettyDate(r.rental!.date)} <span className="muted small">· {daysSince(r.rental!.date)}일째</span>
                        </td>
                        <td className="cell-action">
                          <RentalButton game={r.game} copy={r} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted small">지금 빌려 간 게임이 없어요.</p>
          )}
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h2 className="section-title">👥 친구별 보유 목록</h2>
          <AddGuestForm />
        </div>
        {owners.length > 0 && (
          <div className="chips">
            <button className={`chip ${!ownerFilter ? "on" : ""}`} onClick={() => setOwner("")}>
              전체
            </button>
            {owners.map((o) => (
              <button key={o.owner.id} className={`chip ${ownerFilter === o.owner.id ? "on" : ""}`} onClick={() => setOwner(o.owner.id)}>
                {nameOf(o.owner)} {o.rows.length}
              </button>
            ))}
          </div>
        )}
        {!shownOwners.length && <p className="muted small">아직 아무도 보유 게임을 등록하지 않았어요.</p>}
        {shownOwners.map(({ owner, guest, rows: ownerRows }) => (
          <div key={owner.id} className="owner-block">
            <div className="owner-head">
              <h3 className="owner-title">
                {owner.id === user.uid ? "내 게임" : <>{owner.name}님의 게임</>}
                {owner.guest && <span className="badge badge-unofficial">미등록</span>}{" "}
                <span className="muted small">
                  {ownerRows.length}개 · 대여 중 {ownerRows.filter((r) => r.rental).length}
                </span>
              </h3>
              {guest && (
                <div className="inline-form">
                  <AddGuestGame guest={guest} />
                  <button className="btn btn-ghost btn-sm danger" onClick={() => deleteGuest(guest)}>
                    친구 삭제
                  </button>
                </div>
              )}
            </div>
            {ownerRows.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>게임</th>
                      <th>인원</th>
                      <th>시간</th>
                      <th>상태</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownerRows.map((r) => (
                      <tr key={r.game.id}>
                        {gameCell(r.game)}
                        <td>{players(r.game)}</td>
                        <td>{playTime(r.game.playTime) || "-"}</td>
                        <td>
                          {r.rental ? (
                            <span className="badge badge-rented">
                              {r.rental.uid === user.uid ? "내가" : `${r.rental.name}님`} 대여 중
                            </span>
                          ) : (
                            <span className="badge badge-owned">대여 가능</span>
                          )}
                        </td>
                        <td className="cell-action">
                          <RentalButton game={r.game} copy={r} />
                          {guest && (
                            <button
                              className="btn btn-ghost btn-sm"
                              aria-label="보유 목록에서 빼기"
                              title="보유 목록에서 빼기"
                              onClick={() => setGuestOwned(guest, r.game, false)}
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted small">아직 등록한 게임이 없어요. 오른쪽에서 이 친구가 가진 게임을 추가하세요.</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
