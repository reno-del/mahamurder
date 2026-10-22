// functions 배포 전에 chatbot/의 검색·답변 코드를 functions/로 복사한다 (firebase.json의 functions.predeploy).
// 복사본은 gitignore되고, 고칠 때는 chatbot/ 쪽을 고친다.
import { cpSync, rmSync } from "node:fs";

const root = new URL("..", import.meta.url);
const skip = (src) => !src.includes("__pycache__");
rmSync(new URL("functions/rag", root), { recursive: true, force: true });
cpSync(new URL("chatbot/rag", root), new URL("functions/rag", root), { recursive: true, filter: skip });
cpSync(new URL("chatbot/chat.py", root), new URL("functions/chat.py", root));
console.log("chatbot/chat.py, chatbot/rag → functions/ 복사 완료");
