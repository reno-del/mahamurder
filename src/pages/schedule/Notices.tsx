import { useEffect, useState } from "react";
import { store } from "../../store";
import { useApp, useMyName } from "../../state/AppContext";
import { showError, toast } from "../../lib/toast";
import type { PushState } from "../../types";

const RECENT = 14 * 24 * 60 * 60 * 1000; // 최근 2주 공지만 보여 준다
const MAX_TEXT = 300; // firestore.rules와 같은 값

const fmt = (ms?: number) => {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 전체 공지: 회원 누구나 쓰고, 알림을 켠 기기로는 새 모임 공지와 함께 푸시가 간다 (scripts/send-push.mjs)
export function Notices() {
  const { user, notices } = useApp();
  const myName = useMyName();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const recent = notices.filter((n) => !n.createdAt || Date.now() - n.createdAt < RECENT).slice(0, 5);

  const submit = async () => {
    const t = text.trim();
    if (!t) return toast("공지 내용을 적어 주세요");
    setBusy(true);
    try {
      await store.createNotice({ uid: user.uid, name: myName, text: t });
      setText("");
      setWriting(false);
      toast("공지를 올렸어요. 알림을 켠 친구들에게 곧 전해져요");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = (id: string) => {
    if (confirm("이 공지를 삭제할까요?")) store.deleteNotice(id).catch(showError);
  };

  return (
    <section>
      <div className="section-head">
        <h2 className="section-title">📣 전체 공지</h2>
        <div className="notice-actions">
          <PushToggle />
          {!writing && (
            <button className="btn btn-sm" onClick={() => setWriting(true)}>
              ✏️ 공지 쓰기
            </button>
          )}
        </div>
      </div>
      {writing && (
        <div className="card notice-form">
          <textarea
            className="input"
            rows={3}
            maxLength={MAX_TEXT}
            autoFocus
            placeholder="모두에게 알릴 내용 (예: 이번 주 모임 장소가 신관 6층으로 바뀌었어요)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="notice-form-foot">
            <span className="muted small">
              {text.length}/{MAX_TEXT}
            </span>
            <button className="btn btn-sm btn-ghost" onClick={() => setWriting(false)}>
              취소
            </button>
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={submit}>
              올리기
            </button>
          </div>
        </div>
      )}
      {recent.length ? (
        <div className="notice-list">
          {recent.map((n) => (
            <div key={n.id} className="card notice">
              <div className="notice-meta muted small">
                <b>{n.name}</b> · {fmt(n.createdAt)}
                {n.uid === user.uid && (
                  <button className="btn btn-sm btn-ghost" onClick={() => remove(n.id)}>
                    삭제
                  </button>
                )}
              </div>
              <p className="notice-text">{n.text}</p>
            </div>
          ))}
        </div>
      ) : (
        !writing && <p className="muted small">최근 2주 동안 올라온 공지가 없어요.</p>
      )}
    </section>
  );
}

const IOS_HELP = "아이폰은 사파리 공유 버튼 → '홈 화면에 추가'로 설치한 앱에서 알림을 켤 수 있어요";

// 이 기기로 새 모임·공지 알림 받기
function PushToggle() {
  const { user } = useApp();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    store.pushState().then(setState, () => setState("unsupported"));
  }, []);
  if (!user || !state || state === "unsupported") return null;

  const click = async () => {
    if (state === "ios") return toast(IOS_HELP);
    if (state === "denied") return toast("알림이 차단돼 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요");
    setBusy(true);
    try {
      if (state === "on") {
        if (!confirm("이 기기에서 알림을 끌까요?")) return;
        await store.disablePush();
        toast("알림을 껐어요");
      } else {
        await store.enablePush(user.uid);
        toast("새 모임 공지와 전체 공지를 이 기기로 알려 드릴게요");
      }
      setState(await store.pushState());
    } catch (e) {
      // 직접 만든 안내 문구는 그대로, Firebase 오류는 showError로
      const err = e as { code?: string; message?: string };
      if (err.code) showError(e);
      else toast(err.message || String(e));
      setState(await store.pushState());
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`btn btn-sm${state === "on" ? " btn-on" : ""}`}
      disabled={busy}
      onClick={click}
      title="새 모임 공지·전체 공지가 올라오면 알려 줘요 (10~20분 늦을 수 있어요)"
    >
      {state === "on" ? "🔔 알림 켜짐" : "🔕 알림 받기"}
    </button>
  );
}
