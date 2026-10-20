import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { seoPlugin } from "./seo/plugin";

export default defineConfig({
  // seoPlugin: 메타 태그·구조화 데이터·정적 게임 목록·sitemap/robots/llms.txt (seo/plugin.ts)
  plugins: [react(), seoPlugin()],
  // store.ts에서 top-level await로 백엔드를 고른다
  build: { target: "es2022" },
});
