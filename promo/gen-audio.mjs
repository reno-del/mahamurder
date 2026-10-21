// 영상 타이밍(src/timing.json)에 맞춰 배경음과 효과음을 합성해 public/sound.wav로 저장합니다.
import fs from "node:fs";

const T = JSON.parse(fs.readFileSync("src/timing.json", "utf8"));
const SR = 44100;
const len = Math.ceil((T.total / T.fps) * SR);
const out = new Float32Array(len);
const sec = (frame) => frame / T.fps;
let seed = 1;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

function add(start, dur, fn) {
  const s0 = Math.floor(start * SR);
  for (let i = 0; i < dur * SR && s0 + i < len; i++) out[s0 + i] += fn(i / SR);
}

// 낮게 깔리는 드론
const totalSec = len / SR;
add(0, totalSec, (t) => {
  const env = Math.min(1, t / 2) * Math.min(1, (totalSec - t) / 1.2);
  const trem = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.4 * t);
  return env * trem * (0.1 * Math.sin(2 * Math.PI * 55 * t) + 0.05 * Math.sin(2 * Math.PI * 82.4 * t) + 0.03 * Math.sin(2 * Math.PI * 110.3 * t));
});

// 타자기 소리
function click(at, amp = 0.5) {
  add(at, 0.05, (t) => amp * Math.exp(-t * 140) * (noise() * 0.7 + 0.3 * Math.sin(2 * Math.PI * 1800 * t)));
  add(at + 0.012, 0.03, (t) => amp * 0.4 * Math.exp(-t * 200) * noise());
}
const typed = (text, start, per) => [...text].forEach((ch, i) => ch !== " " && click(sec(start + i * per)));
typed(T.intro.line1, T.intro.line1Start, T.intro.perChar);
typed(T.intro.line2, T.intro.line2Start, T.intro.perChar);
typed("범인은 이 안에 있다.", T.outro.from + 40, 3);

// 장면 전환 쿵
function boom(at, amp = 0.8, length = 0.9) {
  add(at, length, (t) => {
    const f = 40 + 60 * Math.exp(-t * 8);
    return amp * Math.exp(-t * 4.5) * Math.sin(2 * Math.PI * f * t);
  });
  add(at, 0.08, (t) => amp * 0.5 * Math.exp(-t * 50) * noise());
}
boom(sec(T.intro.glitch), 0.9);
T.cuts.forEach((c) => boom(sec(c), 0.7));
boom(sec(T.outro.from), 1.0, 1.6);

// 기능 소개 동안 째깍째깍
for (let f = T.board.from; f < T.outro.from; f += T.fps / 2) {
  const tick = (Math.round((f - T.board.from) / (T.fps / 2)) % 2 === 0) ? 2600 : 2100;
  add(sec(f), 0.03, (t) => 0.12 * Math.exp(-t * 180) * Math.sin(2 * Math.PI * tick * t));
}

// 마지막 종소리
add(sec(T.outro.from + 28), 2.5, (t) => 0.12 * Math.exp(-t * 1.6) * (Math.sin(2 * Math.PI * 880 * t) + 0.5 * Math.sin(2 * Math.PI * 1320 * t)));

// 16비트 WAV로 저장
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
const gain = peak > 0.95 ? 0.95 / peak : 1;
const buf = Buffer.alloc(44 + len * 2);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + len * 2, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(len * 2, 40);
for (let i = 0; i < len; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * gain)) * 32767), 44 + i * 2);
fs.writeFileSync("public/sound.wav", buf);
console.log(`public/sound.wav ${(len / SR).toFixed(1)}s`);
