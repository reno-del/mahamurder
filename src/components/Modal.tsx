import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface ModalApi {
  /**
   * 모달 내용을 바꿔 열기. 내용 컴포넌트가 직접 useApp()을 읽으므로 데이터가 바뀌면 자동으로 다시 그려진다.
   * onClose는 이 내용이 닫힐 때 한 번 불린다(다른 내용으로 바뀌면 불리지 않음).
   */
  openModal: (content: ReactNode, opts?: { onClose?: () => void }) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalApi | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);
  // 같은 컴포넌트로 다시 열어도 폼 상태가 초기화되도록 열 때마다 key를 바꾼다
  const [version, setVersion] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef<(() => void) | undefined>(undefined);

  const openModal = useCallback((c: ReactNode, opts?: { onClose?: () => void }) => {
    onCloseRef.current = opts?.onClose;
    setContent(c);
    setVersion((v) => v + 1);
  }, []);
  const closeModal = useCallback(() => ref.current?.close(), []);

  useEffect(() => {
    const dlg = ref.current;
    if (dlg && content && !dlg.open) dlg.showModal();
  }, [content, version]);

  const api = useMemo(() => ({ openModal, closeModal }), [openModal, closeModal]);

  return (
    <ModalContext.Provider value={api}>
      {children}
      <dialog
        ref={ref}
        className="modal"
        onClose={() => {
          setContent(null);
          const cb = onCloseRef.current;
          onCloseRef.current = undefined;
          cb?.();
        }}
        onClick={(e) => {
          // 바깥(backdrop) 클릭 또는 data-close 버튼으로 닫기
          const t = e.target as HTMLElement;
          if (t === ref.current || t.closest("[data-close]")) closeModal();
        }}
      >
        {content && (
          <div key={version}>
            <button className="modal-close" data-close aria-label="닫기">
              ✕
            </button>
            {content}
          </div>
        )}
      </dialog>
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used inside <ModalProvider>");
  return ctx;
}
