import { usePageMeta } from "../../lib/usePageMeta";

// 사용 설명서 그림(public/usage-guide.png, 원본 usage-guide.html). 화면이 바뀌면 그림을 다시 렌더링해 덮어쓴다
const GUIDE_IMAGE = "/usage-guide.png";

export function GuidePage() {
  usePageMeta("사용 설명서", "머더미스터리 클럽 가입, 홈 화면 앱 설치, 알림 켜기와 메뉴별 기능을 한 장으로 정리했어요.", "guide");
  return (
    <div className="stack">
      <section className="card">
        <h1 className="section-title">📖 사용 설명서</h1>
        <p className="muted small">
          가입, 홈 화면에 앱 설치, 알림 켜기, 메뉴별 기능을 한 장에 모았어요. 글씨가 작으면 그림을 눌러 크게 보세요.
        </p>
        <a className="guide-image" href={GUIDE_IMAGE} target="_blank" rel="noopener">
          <img src={GUIDE_IMAGE} alt="머더미스터리 클럽 사용 설명서: 처음 들어오기, 앱처럼 설치하기, 메뉴별 기능, 모임 흐름" />
        </a>
      </section>
    </div>
  );
}
