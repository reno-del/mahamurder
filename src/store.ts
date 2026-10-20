// 데이터 저장소 선택: Firebase 설정이 있으면 Firestore, 없으면 localStorage 데모 모드
import { firebaseConfig, isConfigured } from "./config";
import type { Store } from "./types";

const backend = isConfigured ? await import("./backend/firebase") : await import("./backend/local");

export const store: Store = await backend.create(firebaseConfig);
