import { useNavigate } from "react-router-dom";
import { store } from "../../store";
import { requireLogin, useApp, useGameHelpers } from "../../state/AppContext";
import { useModal } from "../../components/Modal";
import { Cover } from "../../components/Cover";
import { showError } from "../../lib/toast";
import { displayName, playTime, players, stars, won } from "../../lib/format";
import { GameForm } from "./GameForm";

export function GameDetail({ gameId }: { gameId: string }) {
  const { user, me } = useApp();
  const { gameById, friendRating, playedBy, togglePlayed, toggleLiked, setRating } = useGameHelpers();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();

  const g = gameById(gameId);
  if (!g) return <p className="muted">게임을 찾을 수 없어요.</p>;
  const played = me?.played?.[gameId];
  const liked = me?.liked?.[gameId];
  const fr = friendRating(gameId);
  const friends = playedBy(gameId);

  const remove = async () => {
    if (!requireLogin(user) || !confirm(`'${g.name}'을(를) 삭제할까요?`)) return;
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
          </dl>
          <div className="tags">
            {(g.genres || []).map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      {g.description && <p className="desc">{g.description}</p>}
      {g.link && (
        <p>
          <a href={g.link} target="_blank" rel="noopener">
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
      <div className="detail-footer">
        <button className="btn btn-ghost btn-sm" onClick={() => requireLogin(user) && openModal(<GameForm game={g} />)}>
          정보 수정
        </button>
        <button className="btn btn-ghost btn-sm danger" onClick={remove}>
          삭제
        </button>
      </div>
    </>
  );
}
