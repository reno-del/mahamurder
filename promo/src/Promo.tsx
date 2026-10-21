import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import T from "./timing.json";

// 사이트 다크 모드 색(src/styles/style.css)과 맞춤
const C = { bg: "#0d0b0a", text: "#efe7de", muted: "#a3968a", accent: "#d2404f", gold: "#d9a948", paper: "#efe8de" };
const SERIF = '"Batang", "바탕", "Noto Serif KR", serif';
const SANS = '"Malgun Gothic", "맑은 고딕", sans-serif';
const MONO = '"Consolas", "Courier New", monospace';

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ---------- 공통 효과 ---------- */

function Grain() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.35 }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 12} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
}

function Vignette() {
  return (
    <AbsoluteFill
      style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)" }}
    />
  );
}

// 장면이 바뀔 때 붉은 섬광
function CutFlash() {
  const frame = useCurrentFrame();
  const o = Math.max(0, ...T.cuts.map((c) => interpolate(frame, [c - 2, c, c + 7], [0, 0.55, 0], clamp)));
  return <AbsoluteFill style={{ background: C.accent, opacity: o, mixBlendMode: "screen", pointerEvents: "none" }} />;
}

function useShake(at: number, strength = 14, len = 10) {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [at, at + len], [1, 0], clamp) * (frame >= at ? 1 : 0);
  return {
    x: (random(`x${frame}`) - 0.5) * strength * k,
    y: (random(`y${frame}`) - 0.5) * strength * k,
  };
}

function Cursor({ color = C.text }: { color?: string }) {
  const frame = useCurrentFrame();
  return (
    <span style={{ display: "inline-block", width: "0.08em", height: "0.9em", marginLeft: "0.06em", background: color, opacity: Math.floor(frame / 8) % 2 ? 0 : 1, verticalAlign: "-0.05em" }} />
  );
}

/* ---------- 1. 인트로: 타자기 ---------- */

function Intro() {
  const frame = useCurrentFrame();
  const { line1, line2, line1Start, line2Start, perChar, glitch } = T.intro;
  const n1 = Math.max(0, Math.min(line1.length, Math.floor((frame - line1Start) / perChar) + 1));
  const n2 = Math.max(0, Math.min(line2.length, Math.floor((frame - line2Start) / perChar) + 1));
  const shake = useShake(glitch, 26, 14);
  const glitchOn = frame >= glitch && frame < glitch + 6;
  const zoom = interpolate(frame, [0, T.intro.dur], [1, 1.08]);
  const flicker = 0.9 + random(`f${frame}`) * 0.1;
  const red = new Set([3, 4]); // "범인"

  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center", opacity: flicker }}>
      {/* 머리 위 조명 */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(210,64,79,0.18), transparent 60%)" }} />
      <div style={{ position: "absolute", top: 90, fontFamily: MONO, color: C.muted, fontSize: 30, letterSpacing: 8, opacity: interpolate(frame, [0, 15], [0, 1], clamp) }}>
        CASE No. 2026-1024 · CONFIDENTIAL
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontWeight: 700,
          color: C.text,
          fontSize: 150,
          lineHeight: 1.25,
          textAlign: "center",
          transform: `translate(${shake.x}px, ${shake.y}px) scale(${zoom})`,
          textShadow: glitchOn ? `-8px 0 ${C.accent}, 8px 0 #3cf` : "0 0 40px rgba(0,0,0,0.8)",
        }}
      >
        <div>
          {line1.slice(0, n1)}
          {n2 === 0 && frame >= line1Start && <Cursor />}
        </div>
        <div style={{ minHeight: "1.25em" }}>
          {[...line2.slice(0, n2)].map((ch, i) => (
            <span key={i} style={{ color: red.has(i) ? C.accent : undefined }}>
              {ch}
            </span>
          ))}
          {n2 > 0 && <Cursor color={C.accent} />}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ---------- 2. 증거판: 게임 표지 ---------- */

const PINS = [
  { x: 470, y: 470, r: -7 },
  { x: 960, y: 420, r: 4 },
  { x: 1450, y: 480, r: -3 },
  { x: 650, y: 800, r: 5 },
  { x: 1120, y: 790, r: -5 },
  { x: 1560, y: 820, r: 8 },
];
const STRING_ORDER = [0, 1, 2, 5, 4, 3, 0];

function Board() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = interpolate(frame, [0, T.board.dur], [1.04, 1.0]);
  const stringProgress = interpolate(frame, [30, 75], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const pts = STRING_ORDER.map((i) => PINS[i]);
  const segLens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = segLens.reduce((a, b) => a + b, 0);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y - 165}`).join(" ");

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, #3a2a20 0%, #1a120d 70%, #0b0806 100%)" }}>
      <AbsoluteFill style={{ transform: `scale(${drift})` }}>
        {PINS.map((p, i) => {
          const s = spring({ frame: frame - 4 - i * 5, fps, config: { damping: 11, stiffness: 140 } });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x - 150,
                top: p.y - 180,
                width: 300,
                padding: "16px 16px 54px",
                background: C.paper,
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                transform: `translateY(${(1 - s) * -500}px) rotate(${p.r + (1 - s) * 20}deg) scale(${0.9 + s * 0.1})`,
                opacity: s > 0.01 ? 1 : 0,
              }}
            >
              <Img src={staticFile(`covers/c${i}.jpg`)} style={{ width: 268, height: 268, objectFit: "cover", display: "block", filter: "sepia(0.25) contrast(1.05)" }} />
              <div style={{ position: "absolute", top: -12, left: 136, width: 28, height: 28, borderRadius: "50%", background: C.accent, boxShadow: "0 4px 6px rgba(0,0,0,0.5)" }} />
            </div>
          );
        })}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <path d={d} fill="none" stroke={C.accent} strokeWidth={5} strokeDasharray={total} strokeDashoffset={total * (1 - stringProgress)} style={{ filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.6))" }} />
        </svg>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 70,
          width: "100%",
          textAlign: "center",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 76,
          color: C.text,
          textShadow: "0 6px 24px rgba(0,0,0,0.9)",
          opacity: interpolate(frame, [10, 24], [0, 1], clamp),
          transform: `translateY(${interpolate(frame, [10, 24], [20, 0], clamp)}px)`,
        }}
      >
        친구들과 모은 <span style={{ color: C.accent }}>머더미스터리</span>, 한곳에
      </div>
    </AbsoluteFill>
  );
}

/* ---------- 3. 기능 소개: 사건 파일 ---------- */

interface Feature {
  file: string;
  label: string;
  title: ReactNode;
  sub: string;
  src: string;
  origin: [number, number]; // 확대 중심 (캡처 원본 1920×1080 기준)
  scale: number;
  box: [number, number, number, number]; // x, y, w, h
}

const FEATURES: Feature[] = [
  {
    file: "01",
    label: "게임 소개",
    title: <>어떤 게임이 있는지 <Hl>한눈에</Hl></>,
    sub: "인원 · 시간 · 장르로 골라 보기",
    src: "shots/games.png",
    origin: [330, 840],
    scale: 1.32,
    box: [128, 608, 395, 470],
  },
  {
    file: "02",
    label: "플레이 기록",
    title: <>누가 해 봤고, <Hl>몇 점</Hl>을 줬는지</>,
    sub: "친구들 평점과 내 평점을 함께",
    src: "shots/detail.png",
    origin: [800, 790],
    scale: 1.3,
    box: [488, 760, 625, 90],
  },
  {
    file: "03",
    label: "보유 게임",
    title: <>그 게임, <Hl>누구 집</Hl>에 있더라?</>,
    sub: "친구별 보유 목록과 대여 · 반납 기록",
    src: "shots/library.png",
    origin: [960, 700],
    scale: 1.22,
    box: [155, 590, 1610, 200],
  },
  {
    file: "04",
    label: "일정 모집",
    title: <>이 날, 이 게임 <Hl>할 사람!</Hl></>,
    sub: "모집 공지를 올리고 바로 참여",
    src: "shots/schedule.png",
    origin: [400, 600],
    scale: 1.28,
    box: [128, 347, 538, 502],
  },
];

function Hl({ children }: { children: ReactNode }) {
  return <span style={{ color: C.accent }}>{children}</span>;
}

const SHOT_W = 1440;
const SHOT_K = SHOT_W / 1920;

function FeatureScene({ f }: { f: Feature }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = T.features.dur;
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const zoom = interpolate(frame, [10, dur], [1, f.scale], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const stamp = spring({ frame: frame - 6, fps, config: { damping: 9, stiffness: 220 } });
  const boxDraw = interpolate(frame, [38, 62], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const title = interpolate(frame, [12, 26], [0, 1], clamp);
  const sub = interpolate(frame, [22, 36], [0, 1], clamp);
  const [bx, by, bw, bh] = f.box;
  const perim = 2 * (bw + bh);

  const frameStyle: CSSProperties = {
    position: "absolute",
    left: (1920 - SHOT_W) / 2,
    top: 46,
    width: SHOT_W,
    height: 1080 * SHOT_K,
    overflow: "hidden",
    borderRadius: 18,
    border: "2px solid rgba(255,255,255,0.08)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
    transform: `translateY(${(1 - enter) * 120}px) rotate(${(1 - enter) * -2}deg)`,
    opacity: enter,
  };

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #241a16, ${C.bg} 70%)` }}>
      <div style={frameStyle}>
        <div style={{ width: 1920, height: 1080, transform: `scale(${SHOT_K})`, transformOrigin: "0 0" }}>
          <div style={{ position: "relative", width: 1920, height: 1080, transform: `scale(${zoom})`, transformOrigin: `${f.origin[0]}px ${f.origin[1]}px` }}>
            <Img src={staticFile(f.src)} style={{ width: 1920, height: 1080, display: "block" }} />
            <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
              <rect
                x={bx - 8}
                y={by - 8}
                width={bw + 16}
                height={bh + 16}
                rx={16}
                fill="none"
                stroke={C.accent}
                strokeWidth={7}
                strokeDasharray={perim + 64}
                strokeDashoffset={(perim + 64) * (1 - boxDraw)}
                style={{ filter: "drop-shadow(0 0 12px rgba(210,64,79,0.8))" }}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 사건 파일 도장 */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 36,
          padding: "10px 26px",
          border: `5px solid ${C.accent}`,
          color: C.accent,
          background: "rgba(13,11,10,0.85)",
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: 4,
          transform: `rotate(-6deg) scale(${interpolate(stamp, [0, 1], [2.2, 1])})`,
          opacity: interpolate(stamp, [0, 0.3], [0, 1], clamp),
        }}
      >
        FILE {f.file} · <span style={{ fontFamily: SANS }}>{f.label}</span>
      </div>

      <div style={{ position: "absolute", top: 884, width: "100%", textAlign: "center", fontFamily: SANS, color: C.text }}>
        <div style={{ fontSize: 66, fontWeight: 800, opacity: title, transform: `translateY(${(1 - title) * 24}px)` }}>{f.title}</div>
        <div style={{ fontSize: 34, color: C.muted, marginTop: 8, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)` }}>{f.sub}</div>
      </div>
    </AbsoluteFill>
  );
}

/* ---------- 4. 아웃트로 ---------- */

function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 90 } });
  const tagline = "범인은 이 안에 있다.";
  const nTag = Math.max(0, Math.min(tagline.length, Math.floor((frame - 40) / 3) + 1));
  const url = spring({ frame: frame - 28, fps, config: { damping: 12 } });
  const shake = useShake(0, 18, 10);
  const fadeOut = interpolate(frame, [T.outro.dur - 12, T.outro.dur], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center", opacity: fadeOut }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(210,64,79,0.22), transparent 55%)" }} />
      <div style={{ textAlign: "center", transform: `translate(${shake.x}px, ${shake.y}px)` }}>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 140,
            color: C.text,
            letterSpacing: interpolate(logo, [0, 1], [40, 4]),
            opacity: logo,
            transform: `scale(${interpolate(logo, [0, 1], [1.15, 1])})`,
          }}
        >
          <span style={{ fontSize: 120 }}>🔍</span> 머더미스터리 클럽
        </div>
        <div
          style={{
            display: "inline-block",
            marginTop: 40,
            padding: "16px 44px",
            borderRadius: 999,
            background: C.accent,
            color: "#fff",
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 52,
            letterSpacing: 1,
            opacity: url,
            transform: `scale(${interpolate(url, [0, 1], [0.6, 1])})`,
          }}
        >
          mahamuder.web.app
        </div>
        <div style={{ marginTop: 44, fontFamily: SERIF, fontSize: 48, color: C.muted, minHeight: 60 }}>
          {tagline.slice(0, nTag)}
          {frame >= 40 && <Cursor color={C.muted} />}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ---------- 전체 ---------- */

export function Promo() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Audio src={staticFile("sound.wav")} />
      <Sequence from={T.intro.from} durationInFrames={T.intro.dur}>
        <Intro />
      </Sequence>
      <Sequence from={T.board.from} durationInFrames={T.board.dur}>
        <Board />
      </Sequence>
      {FEATURES.map((f, i) => (
        <Sequence key={f.file} from={T.features.from + i * T.features.dur} durationInFrames={T.features.dur}>
          <FeatureScene f={f} />
        </Sequence>
      ))}
      <Sequence from={T.outro.from} durationInFrames={T.outro.dur}>
        <Outro />
      </Sequence>
      <Vignette />
      <Grain />
      <CutFlash />
    </AbsoluteFill>
  );
}
