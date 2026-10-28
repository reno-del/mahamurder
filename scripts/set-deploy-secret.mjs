// .env.secret의 FIREBASE_SERVICE_ACCOUNT(키 JSON 파일 경로 또는 JSON 내용)를 읽어
// GitHub 저장소 비밀값으로 등록한다. .github/workflows/deploy.yml이 이 값을 쓴다.
// 사용: node scripts/set-deploy-secret.mjs  (gh가 reno-del로 로그인되어 있어야 함)
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const REPO = "reno-del/mahamurder";
const PROJECT_ID = "mahamuder";
const NAME = "FIREBASE_SERVICE_ACCOUNT";

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!existsSync(".env.secret")) fail(".env.secret 파일이 없어요. 저장소 루트에서 실행하세요.");

const line = readFileSync(".env.secret", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith(`${NAME}=`));
let value = line ? line.slice(NAME.length + 1).trim() : "";
value = value.replace(/^(['"])(.*)\1$/, "$2");
if (!value) fail(`.env.secret의 ${NAME}=가 비어 있어요.`);

let json = value;
if (!value.startsWith("{")) {
  if (!existsSync(value)) fail(`키 파일을 찾을 수 없어요: ${value}`);
  json = readFileSync(value, "utf8");
}

let key;
try {
  key = JSON.parse(json);
} catch {
  fail("서비스 계정 키가 올바른 JSON이 아니에요.");
}
if (key.type !== "service_account" || !key.private_key || !key.client_email) {
  fail("서비스 계정 키 형식이 아니에요(type, private_key, client_email 필요).");
}
if (key.project_id !== PROJECT_ID) {
  fail(`다른 프로젝트의 키예요: ${key.project_id} (필요: ${PROJECT_ID})`);
}

const gh = process.platform === "win32" ? "C:\\Program Files\\GitHub CLI\\gh.exe" : "gh";
const result = spawnSync(gh, ["secret", "set", NAME, "--repo", REPO], {
  input: JSON.stringify(key),
  stdio: ["pipe", "inherit", "inherit"],
});
if (result.status !== 0) fail("gh secret set이 실패했어요.");
console.log(`✔ ${REPO}에 ${NAME}를 등록했어요 (${key.client_email}).`);
