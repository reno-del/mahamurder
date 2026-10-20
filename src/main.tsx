import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider } from "./state/AppContext";
import { ModalProvider } from "./components/Modal";
import { Layout } from "./components/Layout";
import { GamesPage } from "./pages/games/GamesPage";
import { SchedulePage } from "./pages/schedule/SchedulePage";
import { MyPage } from "./pages/mypage/MyPage";
import { LibraryPage } from "./pages/library/LibraryPage";
import "./styles/style.css";

// 예전 해시 주소(#/games, #/schedule/new/<id> 등)로 들어오면 같은 경로 주소로 바꾼다.
// 카톡방 등에 공유된 옛 링크가 계속 동작하도록 렌더링 전에 처리한다
if (location.hash.startsWith("#/")) history.replaceState(null, "", location.hash.slice(1));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // 게임 상세(/games/<id>)는 목록 위에 모달로 뜨므로 목록 스크롤을 유지한다
    if (!pathname.startsWith("/games/")) window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// 경로 주소를 쓰므로 Firebase Hosting에서 모든 경로를 index.html로 돌려준다 (firebase.json rewrites)
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <ModalProvider>
          <ScrollToTop />
          <Layout>
            <Routes>
              <Route path="/games" element={<GamesPage />} />
              <Route path="/games/:gameId" element={<GamesPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/schedule/new/:gameId" element={<SchedulePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="*" element={<Navigate to="/games" replace />} />
            </Routes>
          </Layout>
        </ModalProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);
