import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // store.ts에서 top-level await로 백엔드를 고른다
  build: { target: "es2022" },
});
