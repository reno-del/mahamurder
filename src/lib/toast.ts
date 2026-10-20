// 화면 하단 토스트. React 트리 밖에서도 호출할 수 있게 DOM에 직접 붙인다.
export function toast(msg: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

const ERROR_MESSAGES: Record<string, string> = {
  "permission-denied": "권한이 없어요",
  "auth/configuration-not-found": "Firebase 콘솔에서 Google 로그인이 아직 설정되지 않았어요",
  "auth/unauthorized-domain": "이 도메인은 Firebase 승인된 도메인에 없어요",
};

export function showError(e: unknown) {
  console.error(e);
  const err = e as { code?: string; message?: string } | undefined;
  toast((err?.code && ERROR_MESSAGES[err.code]) || "오류가 발생했어요: " + (err?.message || String(e)));
}
