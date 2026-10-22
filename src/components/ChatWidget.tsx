import { useEffect, useRef, useState, type FormEvent } from "react";
import { store } from "../store";
import { useApp } from "../state/AppContext";

type Source = { title: string; url: string; score: number };
type Message =
  | { role: "user"; text: string }
  | { role: "bot"; text: string; conditions?: string; sources?: Source[]; error?: boolean };

// 페이지를 옮겨 다녀도 대화가 남도록 모듈 변수에 둔다
let history: Message[] = [];

async function ask(question: string): Promise<Message> {
  const token = await store.getIdToken();
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) return { role: "bot", text: (await res.text()) || `오류가 났어요 (${res.status})`, error: true };
  const data = await res.json();
  return { role: "bot", text: data.answer, conditions: data.conditions, sources: data.sources };
}

/** 오른쪽 아래 떠 있는 챗봇 버튼과 대화 창. 사이트 자료(게임·FAQ·사용법)로 답하고 근거의 유사도와 링크를 보여 준다 */
export function ChatWidget() {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(history);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    history = messages;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  // 외부 API 비용이 들어 회원에게만 보인다
  if (!user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    const reply = await ask(question).catch(
      (): Message => ({ role: "bot", text: "챗봇 서버에 연결하지 못했어요.", error: true }),
    );
    setMessages((m) => [...m, reply]);
    setBusy(false);
  }

  return (
    <>
      {open && (
        <section className="chat-panel card" aria-label="챗봇">
          <header className="chat-head">
            <strong>🕵️ 클럽 챗봇</strong>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="닫기">
              ✕
            </button>
          </header>
          <div className="chat-list" ref={listRef}>
            {messages.length === 0 && (
              <p className="muted chat-hint">
                게임 추천이나 사이트 사용법을 물어보세요.
                <br />예: 5명이서 2시간 안에 끝나는 게임 있어?
              </p>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="chat-msg chat-user">{m.text}</div>
              ) : (
                <div key={i} className={`chat-msg chat-bot${m.error ? " chat-error" : ""}`}>
                  <div className="chat-text">{m.text}</div>
                  {m.conditions && <div className="chat-meta">적용한 조건: {m.conditions}</div>}
                  {m.sources && m.sources.length > 0 && (
                    <details className="chat-sources">
                      <summary>
                        참고한 원문 · 최고 유사도 {Math.max(...m.sources.map((s) => s.score)).toFixed(4)}
                      </summary>
                      <ol>
                        {m.sources.map((s, j) => (
                          <li key={j}>
                            <code>{s.score.toFixed(4)}</code>{" "}
                            <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              ),
            )}
            {busy && <div className="chat-msg chat-bot muted">찾는 중...</div>}
          </div>
          <form className="chat-form" onSubmit={onSubmit}>
            <input
              className="input"
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              placeholder="질문을 입력하세요"
            />
            <button className="btn btn-primary" disabled={busy || !input.trim()}>
              보내기
            </button>
          </form>
        </section>
      )}
      <button className="chat-fab btn btn-primary" onClick={() => setOpen((o) => !o)} aria-label="챗봇 열기">
        {open ? "✕" : "💬 챗봇"}
      </button>
    </>
  );
}
