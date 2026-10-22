// Firebase 설정은 .env의 VITE_FIREBASE_* 값에서 읽습니다.
// API 키가 비어 있으면 브라우저 localStorage에 저장하는 "데모 모드"로 동작합니다.
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: env.VITE_FIREBASE_APP_ID ?? "",
};

export type FirebaseConfig = typeof firebaseConfig;

// `npm run dev:demo`(VITE_DEMO=1)로 실행하면 설정이 있어도 데모 모드로 동작해 실제 데이터를 건드리지 않는다
export const isConfigured = firebaseConfig.apiKey !== "" && !firebaseConfig.apiKey.startsWith("YOUR_") && env.VITE_DEMO !== "1";
