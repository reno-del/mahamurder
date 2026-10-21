import { useMemo, useState, type ChangeEvent } from "react";
import { store } from "../../store";
import { useModal } from "../../components/Modal";
import { requireLogin, useApp } from "../../state/AppContext";
import { showError, toast } from "../../lib/toast";
import { playTime, players } from "../../lib/format";
import { csvToGames, matchExisting, normalizeName, readCsvFile, type CsvGame, type Match } from "../../lib/csvGames";

// CSV 파일(murder_mystery_games.csv 형식)을 읽어 사이트에 아직 없는 게임만 골라 등록한다.
// 사이트 게임 목록은 useApp()에서 직접 읽으므로, 그사이 누가 게임을 추가해도 판정이 최신으로 바뀐다
export function CsvImport() {
  const { user, games } = useApp();
  const { closeModal } = useModal();
  const [parsed, setParsed] = useState<{ rows: CsvGame[]; skipped: number[] } | null>(null);
  // 사용자가 직접 바꾼 체크만 기억한다 (나머지는 "새 게임이면 체크"가 기본)
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { games: rows, skipped } = csvToGames(await readCsvFile(file));
      setParsed({ rows, skipped });
      setPicked({});
    } catch (err) {
      setParsed(null);
      showError(err);
    }
  };

  const matches = useMemo(() => (parsed ? matchExisting(parsed.rows, games) : []), [parsed, games]);
  const candidates = matches.filter((m) => m.status !== "exists");
  const count = (s: Match["status"]) => matches.filter((m) => m.status === s).length;
  const isPicked = (m: Match) => picked[m.row] ?? m.status === "new";
  const selected = candidates.filter(isPicked);
  const key = normalizeName(q);
  const shown = key ? candidates.filter((m) => normalizeName(m.game.name).includes(key)) : candidates;

  const setAll = (on: boolean) =>
    setPicked((p) => ({ ...p, ...Object.fromEntries(shown.map((m) => [m.row, on])) }));

  const onImport = async () => {
    if (!requireLogin(user) || !user || !selected.length) return;
    const n = selected.length;
    if (!confirm(`게임 ${n}개를 등록할까요?`)) return;
    setBusy(true);
    try {
      await store.importGames(selected.map((m) => ({ ...m.game, createdBy: user.uid })));
      toast(`${n}개 등록했어요`);
      closeModal();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>CSV로 게임 가져오기</h2>
      <p className="muted">
        게임 목록 CSV(murder_mystery_games.csv 형식)를 고르면 사이트에 아직 없는 게임만 골라 보여 줘요. 이름이 비슷한
        게임은 같은 게임인지 확인하고 골라 주세요.
      </p>
      <input className="input" type="file" accept=".csv,text/csv" onChange={onFile} />

      {parsed && (
        <>
          <p className="csv-import-summary">
            새 게임 <b>{count("new")}</b> · 비슷한 이름 <b>{count("similar")}</b> · 이미 있음 <b>{count("exists")}</b>
            {parsed.skipped.length > 0 && <span className="muted"> · 이름이 없어 건너뛴 줄 {parsed.skipped.length}</span>}
          </p>
          {candidates.length === 0 ? (
            <div className="empty">CSV의 게임이 모두 사이트에 있어요.</div>
          ) : (
            <>
              <div className="csv-import-tools">
                <input className="input" placeholder="이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
                <button type="button" className="btn btn-sm" onClick={() => setAll(true)}>
                  모두 선택
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setAll(false)}>
                  모두 해제
                </button>
              </div>
              <ul className="csv-import-list">
                {shown.map((m) => (
                  <li key={m.row}>
                    <label>
                      <input
                        type="checkbox"
                        checked={isPicked(m)}
                        onChange={(e) => setPicked((p) => ({ ...p, [m.row]: e.target.checked }))}
                      />
                      <span>
                        <b>{m.game.name}</b>
                        {m.status === "similar" && m.existing && (
                          <span className="csv-import-similar">
                            {" "}
                            ≈ 사이트의 "{m.existing.name}" ({m.reason})
                          </span>
                        )}
                        <br />
                        <small className="muted">
                          {[players(m.game), playTime(m.game.playTime), (m.game.genres || []).join(", ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                    </label>
                  </li>
                ))}
                {!shown.length && <li className="muted">검색 결과가 없어요.</li>}
              </ul>
            </>
          )}
        </>
      )}

      <div className="form-actions">
        <button type="button" className="btn" data-close>
          닫기
        </button>
        <button type="button" className="btn btn-primary" disabled={busy || !selected.length} onClick={onImport}>
          {busy ? "등록하는 중…" : `선택한 ${selected.length}개 등록`}
        </button>
      </div>
    </>
  );
}
