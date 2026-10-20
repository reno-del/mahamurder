// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹) 에서 복사한 값으로 교체하세요.
// 값을 채우기 전에는 브라우저 localStorage에 저장하는 "데모 모드"로 동작합니다.
export const firebaseConfig = {
  apiKey: "AIzaSyAmLqQV1URJdfjTQiiNs0gZDehhWijXWC4",
  authDomain: "mahamuder.firebaseapp.com",
  projectId: "mahamuder",
  storageBucket: "mahamuder.firebasestorage.app",
  messagingSenderId: "1031246131247",
  appId: "1:1031246131247:web:99c32af6929932bb9016da",
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");
