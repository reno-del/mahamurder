import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { store } from "../../store";
import { useApp } from "../../state/AppContext";
import { toast } from "../../lib/toast";
import { usePageMeta } from "../../lib/usePageMeta";

// 초대 링크 /join/<code>. 회원이 되면 게임 목록으로 보낸다
export function JoinPage() {
  const { code = "" } = useParams();
  const { user, outsider, authReady } = useApp();
  const [busy, setBusy] = useState(false);
  usePageMeta("초대", "머더미스터리 클럽 초대 링크", "");

  if (user) return <Navigate to="/games" replace />;
  if (!authReady) return null;

  const accept = async () => {
    setBusy(true);
    try {
      await store.join(code);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="empty big">
      <h2>🕵️ 머더미스터리 클럽에 초대받았어요</h2>
      <p className="muted">
        친구들의 플레이 기록을 보고, 모임에 참여하고, 서로 가진 게임을 빌릴 수 있어요.
        {outsider && (
          <>
            <br />
            {outsider.name}님 계정으로 참여해요.
          </>
        )}
      </p>
      <button className="btn btn-primary" onClick={accept} disabled={busy}>
        {outsider ? "초대 수락하기" : store.mode === "local" ? "데모 로그인하고 참여하기" : "Google로 로그인하고 참여하기"}
      </button>
    </section>
  );
}
