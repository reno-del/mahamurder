// 새 모임 공지(events)와 전체 공지(notices)를 알림을 켠 회원 기기에 웹 푸시로 보낸다.
// GitHub Actions(.github/workflows/push.yml)가 10분마다 실행한다. 서버가 없어 이 방식을 쓰므로 알림은 몇 분~수십 분 늦을 수 있다.
//
//   GOOGLE_APPLICATION_CREDENTIALS=<서비스 계정 키 JSON> node scripts/send-push.mjs [--dry-run]
//
// 보낸 것은 pushLog/{event_<id> | notice_<id>}에 남긴다(규칙상 앱에서는 못 읽고 못 씀).
// pushLog/_init이 없으면(처음 실행) 지금 있는 일정·공지를 보낸 것으로만 표시하고 아무것도 보내지 않는다.
// --dry-run은 읽기만 하고 보낼 내용을 출력한다.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const PROJECT = "mahamuder";
const SITE = "https://mahamuder.web.app";
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
const API = "https://firestore.googleapis.com/v1/";
// 워크플로가 한동안 멈췄다 다시 돌 때 묵은 알림을 몰아 보내지 않도록, 이보다 오래된 것은 표시만 하고 넘긴다
const MAX_AGE = 24 * 60 * 60 * 1000;
const dryRun = process.argv.includes("--dry-run");

// ---------- 서비스 계정 인증 (의존성 없이 JWT를 직접 서명) ----------
async function accessToken() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS에 서비스 계정 키 경로를 넣어 주세요");
  const key = JSON.parse(readFileSync(keyPath, "utf8"));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  if (!res.ok) throw new Error(`토큰 발급 실패 ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

const token = await accessToken();
async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// ---------- Firestore REST ----------
function decode(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("mapValue" in v) return fields(v.mapValue.fields);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  return null;
}
const fields = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));

async function list(collection) {
  const out = [];
  let pageToken = "";
  do {
    const q = new URLSearchParams({ pageSize: "300", ...(pageToken && { pageToken }) });
    const r = await call(`${API}${DOCS}/${collection}?${q}`);
    if (!r.ok) throw new Error(`${collection} 읽기 실패 ${r.status}: ${JSON.stringify(r.body)}`);
    for (const d of r.body.documents || []) out.push({ id: d.name.split("/").pop(), ...fields(d.fields) });
    pageToken = r.body.nextPageToken || "";
  } while (pageToken);
  return out;
}

// 여러 문서를 한 번에 쓰거나 지운다 (commit은 500개까지)
async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const r = await call(`${API}${DOCS}:commit`, { method: "POST", body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
    if (!r.ok) throw new Error(`쓰기 실패 ${r.status}: ${JSON.stringify(r.body)}`);
  }
}
const logWrite = (id, sent) => ({
  update: {
    name: `${DOCS}/pushLog/${id}`,
    fields: { at: { timestampValue: new Date().toISOString() }, sent: { integerValue: String(sent) } },
  },
});
const tokenDelete = (id) => ({ delete: `${DOCS}/pushTokens/${id}` });

// ---------- 보낼 내용 ----------
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
function prettyDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return `${m}월 ${d}일(${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}
const cleanName = (name) => String(name || "").replace(/^예시\)\s*/, "");

function eventMessage(e) {
  const limit = e.minPlayers === e.maxPlayers ? e.maxPlayers : `${e.minPlayers}~${e.maxPlayers}`;
  return {
    from: e.hostUid,
    title: `📢 새 모임: ${cleanName(e.gameName)}`,
    body: [`${prettyDate(e.date)} ${e.time || ""}`.trim(), e.place && `📍${e.place}`, `${limit}명 · ${e.hostName}`]
      .filter(Boolean)
      .join(" · "),
    link: `${SITE}/schedule/${e.id}`,
    tag: `event-${e.id}`,
  };
}
const noticeMessage = (n) => ({
  from: n.uid,
  title: `📣 ${n.name}님의 공지`,
  body: n.text,
  link: `${SITE}/schedule`,
  tag: `notice-${n.id}`,
});

// ---------- FCM ----------
// 알림 표시는 public/sw.js의 push 처리기가 data를 읽어 직접 한다 (data 값은 모두 문자열이어야 함)
async function send(fcmToken, { title, body, link, tag }) {
  const message = {
    token: fcmToken,
    data: { title, body, link, tag },
    webpush: { headers: { TTL: "86400", Urgency: "high" } },
  };
  const r = await call(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  if (r.ok) return "sent";
  const code = r.body.error?.details?.find((d) => d.errorCode)?.errorCode;
  // 앱을 지웠거나 알림을 끈 기기의 토큰
  if (code === "UNREGISTERED" || (code === "INVALID_ARGUMENT" && /registration token/i.test(r.body.error?.message || ""))) return "stale";
  throw new Error(`FCM 전송 실패 ${r.status}: ${JSON.stringify(r.body.error || r.body)}`);
}

// ---------- 실행 ----------
const [events, notices, logs, tokens] = await Promise.all([list("events"), list("notices"), list("pushLog"), list("pushTokens")]);
const logged = new Set(logs.map((l) => l.id));
const items = [
  ...events.map((e) => ({ key: `event_${e.id}`, at: e.createdAt, past: e.date < kstToday(), msg: () => eventMessage(e) })),
  ...notices.map((n) => ({ key: `notice_${n.id}`, at: n.createdAt, past: false, msg: () => noticeMessage(n) })),
].filter((it) => !logged.has(it.key));

if (!logged.has("_init")) {
  console.log(`처음 실행: 지금 있는 일정·공지 ${items.length}개를 보낸 것으로 표시만 해요`);
  if (!dryRun) await commit([...items.map((it) => logWrite(it.key, 0)), logWrite("_init", 0)]);
  process.exit(0);
}

console.log(`새로 보낼 것 ${items.length}개, 알림 받는 기기 ${tokens.length}대`);
const writes = [];
const stale = new Set();
let failed = 0;
for (const it of items) {
  // 만든 시각이 없거나 오래됐거나 이미 지난 일정은 보내지 않는다
  if (!it.at || Date.now() - it.at > MAX_AGE || it.past) {
    console.log(`- ${it.key}: 오래돼서 건너뜀`);
    writes.push(logWrite(it.key, 0));
    continue;
  }
  const msg = it.msg();
  const targets = tokens.filter((t) => t.uid !== msg.from && !stale.has(t.id));
  console.log(`- ${it.key}: "${msg.title}" / "${msg.body}" → ${targets.length}대`);
  if (dryRun) continue;
  let sent = 0;
  for (const t of targets) {
    try {
      const r = await send(t.id, msg);
      if (r === "sent") sent++;
      else stale.add(t.id);
    } catch (err) {
      failed++;
      console.error(`  ${t.uid} 기기 실패: ${err.message}`);
    }
  }
  writes.push(logWrite(it.key, sent));
}
writes.push(...[...stale].map(tokenDelete));
if (stale.size) console.log(`더 이상 쓰지 않는 기기 ${stale.size}대를 지워요`);
if (!dryRun && writes.length) await commit(writes);
// 권한 문제 등으로 실패하면 워크플로를 실패로 표시해 알 수 있게 한다
if (failed) process.exit(1);
