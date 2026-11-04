import type { PushState } from "../types";

// 브라우저가 웹 푸시를 받을 수 있는지. 받을 수 있으면 null
export function pushSupport(): PushState | null {
  if ("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) return null;
  // 아이폰·아이패드(데스크톱 모드 사파리는 Mac으로 보임)는 홈 화면에 추가한 앱에서만 푸시를 쓸 수 있다
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "unsupported";
}
