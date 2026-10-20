// 데이터 저장소 선택: Firebase 설정이 있으면 Firestore, 없으면 localStorage 데모 모드
import { firebaseConfig, isConfigured } from "./config.js";

const backend = isConfigured
  ? await import("./backend-firebase.js")
  : await import("./backend-local.js");

export const store = await backend.create(firebaseConfig);
