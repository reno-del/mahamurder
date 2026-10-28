import { useNavigate } from "react-router-dom";
import { store } from "../../store";
import { requireLogin, useApp, useGameHelpers } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { Cover } from "../../components/Cover";
import { showError, toast } from "../../lib/toast";
import { displayName, playTime, players, prettyDate, safeUrl, stars, won } from "../../lib/format";
import { RentalButton } from "../../components/RentalButton";
import { GameForm } from "./GameForm";
import { categoryName, categoryOf } from "../../lib/category";

export function GameDetail({ gameId }: { gameId: string }) {
  const { user, me, events } = useApp();
  const { gameById, friendRating, playedBy, togglePlayed, toggleLiked, setRating, copiesOf, toggleOwned } = useGameHelpers();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();

  const g = gameById(gameId);
  if (!g) return <p className="muted">게임을 찾을 수 없어요.</p>;
  const played = me?.played?.[gameId];
  const liked = me?.liked?.[gameId];
  const fr = friendRating(gameId);
  const friends = playedBy(gameId);
  const owned = me?.owned?.[gameId];
  const copies = copiesOf(g);

  // 실수로 지우지 않도록 등록한 사람만, 친구들의 기록이 없을 때만 삭제할 수 있다
  const canDelete = !!user && (!g.createdBy || g.createdBy === user.uid);
  const linked = [
    friends.length && `플레이 기록 ${friends.length}개`,
    copies.length && `보유 ${copies.length}명`,
    events.filter((e) => e.gameId === gameId).length && "모집 공지",
  ].filter(Boolean);
  const remove = async () => {
    if (!requireLogin(user)) return;
    if (linked.length) return toast(`친구들의 기록(${linked.join(", ")})이 남아 있어 삭제할 수 없어요`);
    if (!confirm(`'${g.name}'을(를) 삭제할까요?`)) return;
    await store.deleteGame(gameId).catch(showError);
    closeModal();
  };

  return (
    <>
      <div className="detail">
        <Cover game={g} className="cover-lg" />
        <div>
          <h2>{g.name}</h2>
          <p className="muted">{g.publisher || ""}</p>
          <div className="rating">
            <span className="stars">{stars(g.rating)}</span> <b>{g.rating ? Number(g.rating).toFixed(1) : "-"}</b>{" "}
            <span className="muted small">외부 평가</span>
          </div>
          {fr && (
            <div className="rating">
              <span className="stars">{stars(fr.avg)}</span> <b>{fr.avg.toFixed(1)}</b>{" "}
              <span className="muted small">친구 {fr.count}명 평균</span>
            </div>
          )}
          <dl className="facts facts-wide">
            <div>
              <dt>가격</dt>
              <dd>{won(g.price)}</dd>
            </div>
            <div>
              <dt>출시일</dt>
              <dd>{g.releaseDate || "-"}</dd>
            </div>
            <div>
              <dt>인원</dt>
              <dd>{players(g)}</dd>
            </div>
            <div>
              <dt>플레이 시간</dt>
              <dd>{playTime(g.playTime) || "-"}</dd>
            </div>
            <div>
              <dt>난이도</dt>
              <dd>{g.difficulty || "-"}</dd>
            </div>
            <div>
              <dt>정발</dt>
              <dd>{g.localized === false ? "미정발" : "정발됨"}</dd>
            </div>
            <div>
              <dt>구비</dt>
              <dd>{copies.length ? `${copies.length}명 보유` : user ? "구비 안 됨" : "-"}</dd>
            </div>
          </dl>
          {categoryOf(g) && (
            <div className="tags">
              <span className="tag">{categoryName(categoryOf(g))}</span>
            </div>
          )}
        </div>
      </div>
      {g.description && <p className="desc">{g.description}</p>}
      {safeUrl(g.link) && (
        <p>
          <a href={safeUrl(g.link)} target="_blank" rel="noopener noreferrer">
            구매 / 상세 페이지 ↗
          </a>
        </p>
      )}

      <div className="detail-actions">
        <button className={`btn ${played ? "btn-on" : ""}`} onClick={() => togglePlayed(gameId)}>
          {played ? "✔ 플레이함" : "플레이 했어요"}
        </button>
        <button className={`btn ${liked ? "btn-on" : ""}`} onClick={() => toggleLiked(gameId)}>
          {liked ? "♥ 선호" : "♡ 하고 싶어요"}
        </button>
        <button className={`btn ${owned ? "btn-on" : ""}`} onClick={() => toggleOwned(g)}>
          {owned ? "📦 내가 보유 중" : "📦 가지고 있어요"}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            closeModal();
            navigate(`/schedule/new/${gameId}`);
          }}
        >
          📅 이 게임으로 모집하기
        </button>
      </div>
      {copies.map((c) => {
        const ownerName = c.owner.id === user?.uid ? "내" : `${c.owner.name}님${c.owner.guest ? "(미등록)" : ""}`;
        return (
          <div key={c.owner.id} className={`rental-box ${c.rental ? "rented" : ""}`}>
            {c.rental ? (
              <span>
                🔑 {ownerName} 게임 · <b>{c.rental.uid === user?.uid ? "내가" : `${c.rental.name}님이`}</b> 대여 중{" "}
                <span className="muted small">({prettyDate(c.rental.date)}부터)</span>
              </span>
            ) : (
              <span>📦 {ownerName} 게임 · 대여 가능</span>
            )}
            <RentalButton game={g} copy={c} />
          </div>
        );
      })}
      {played && (
        <div className="my-rating">
          내 평점{" "}
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`star-btn ${played.rating >= n ? "on" : ""}`}
              aria-label={`${n}점`}
              onClick={() => setRating(gameId, n)}
            >
              ★
            </button>
          ))}
        </div>
      )}
      <h3 className="section-title">이 게임을 해 본 친구 ({friends.length})</h3>
      {friends.length ? (
        <ul className="people">
          {friends.map((p) => (
            <li key={p.id}>
              {displayName(p) || "익명"}
              {p.played![gameId].rating > 0 && <span className="stars small"> {stars(p.played![gameId].rating)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">
          {user ? "아직 아무도 안 해 봤어요 — 모두 처음이라 모집하기 좋아요!" : "로그인하면 친구들의 기록을 볼 수 있어요."}
        </p>
      )}
      {user && (
        <div className="detail-footer">
          <button className="btn btn-ghost btn-sm" onClick={() => openModal(<GameForm game={g} />)}>
            정보 수정
          </button>
          {canDelete && (
            <button className="btn btn-ghost btn-sm danger" onClick={remove}>
              삭제
            </button>
          )}
        </div>
      )}
    </>
  );
}
