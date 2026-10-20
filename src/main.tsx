import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider } from "./state/AppContext";
import { ModalProvider } from "./components/Modal";
import { Layout } from "./components/Layout";
import { GamesPage } from "./pages/games/GamesPage";
import { SchedulePage } from "./pages/schedule/SchedulePage";
import { MyPage } from "./pages/mypage/MyPage";
import { LibraryPage } from "./pages/library/LibraryPage";
import "./styles/style.css";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// 기존 주소(#/games, #/schedule, #/mypage)를 그대로 쓰기 위해 HashRouter 사용
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <ModalProvider>
          <ScrollToTop />
          <Layout>
            <Routes>
              <Route path="/games" element={<GamesPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/schedule/new/:gameId" element={<SchedulePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="*" element={<Navigate to="/games" replace />} />
            </Routes>
          </Layout>
        </ModalProvider>
      </AppProvider>
    </HashRouter>
  </StrictMode>
);
