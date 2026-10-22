import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { seoPlugin } from "./seo/plugin";

export default defineConfig({
  // seoPlugin: 메타 태그·구조화 데이터·정적 게임 목록·sitemap/robots/llms.txt (seo/plugin.ts)
  plugins: [react(), seoPlugin()],
  // store.ts에서 top-level await로 백엔드를 고른다
  build: { target: "es2022" },
  // 개발 중 챗봇 API는 Functions 에뮬레이터로 보낸다 (배포된 사이트에서는 firebase.json rewrite가 처리)
  server: {
    proxy: {
      "/api/chat": {
        target: "http://127.0.0.1:5001",
        rewrite: () => "/mahamuder/asia-northeast3/chat",
      },
    },
  },
});
