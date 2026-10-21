import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { store } from "../store";
import { useApp, useMyName } from "../state/AppContext";
import { showError } from "../lib/toast";
import { useLiveStructuredData } from "../lib/usePageMeta";

function AuthBox() {
  const { user, outsider, authReady } = useApp();
  const name = useMyName();
  if (!authReady) return <div className="auth" />;
  if (outsider)
    return (
      <div className="auth">
        <span className="auth-name">{outsider.name} (초대 전)</span>
        <button className="btn btn-ghost btn-sm" onClick={() => store.logout()}>
          로그아웃
        </button>
      </div>
    );
  if (!user)
    return (
      <div className="auth">
        <button className="btn btn-primary btn-sm" onClick={() => store.login().catch(showError)}>
          {store.mode === "local" ? "데모 로그인" : "Google 로그인"}
        </button>
      </div>
    );
  return (
    <div className="auth">
      {user.photo && <img className="avatar" src={user.photo} alt="" referrerPolicy="no-referrer" />}
      <span className="auth-name">{name}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => store.logout()}>
        로그아웃
      </button>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  useLiveStructuredData();
  return (
    <>
      <header className="topbar">
        <Link className="brand" to="/games">
          <span className="brand-mark">🔍</span> 머더미스터리 클럽
        </Link>
        <nav className="nav">
          <NavLink to="/games">게임 소개</NavLink>
          <NavLink to="/schedule">일정 모집</NavLink>
          <NavLink to="/library">보유 게임</NavLink>
          <NavLink to="/mypage">마이페이지</NavLink>
        </nav>
        <AuthBox />
      </header>

      {store.mode === "local" && (
        <div className="demo-banner">
          데모 모드 — Firebase 설정 전이라 데이터가 이 브라우저에만 저장됩니다. <code>src/config.ts</code>를 채우면 친구들과
          공유됩니다.
        </div>
      )}

      <main className="view">{children}</main>

      <footer className="footer">머더미스터리 클럽 · 스포일러 금지 🤫</footer>
    </>
  );
}

/** 로그인이 필요한 페이지의 안내 화면. 로그인했지만 회원이 아니면 초대 안내를 보여 준다 */
export function LoginRequired({ title, message }: { title: string; message: string }) {
  const { outsider } = useApp();
  if (outsider)
    return (
      <section className="empty big">
        <h2>{title}</h2>
        <p className="muted">
          친구들끼리만 쓰는 공간이에요. 이미 쓰고 있는 친구에게 초대 링크를 받아 열어 주세요.
          <br />
          다른 Google 계정으로 들어왔다면 로그아웃 후 다시 로그인해 보세요.
        </p>
        <button className="btn" onClick={() => store.logout()}>
          로그아웃
        </button>
      </section>
    );
  return (
    <section className="empty big">
      <h2>{title}</h2>
      <p className="muted">{message}</p>
      <button className="btn btn-primary" onClick={() => store.login().catch(showError)}>
        로그인
      </button>
    </section>
  );
}
