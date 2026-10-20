"use client";

import { useEffect, useId, useRef } from "react";

const VIEW_W = 1600;
const VIEW_H = 180;
const BEATS = 8;
const CYCLE = VIEW_W / BEATS;
const BPM = 75;

/** Flat baseline, small P wave, sharp QRS, rounded T, then baseline. */
function beat(origin: number): string {
  const x = (n: number) => (origin + n).toFixed(1);
  return [
    `L ${x(52)} 112`,
    `C ${x(60)} 112 ${x(66)} 100 ${x(74)} 100`,
    `C ${x(82)} 100 ${x(88)} 112 ${x(100)} 112`,
    `L ${x(112)} 112`,
    `L ${x(118)} 122`,
    `L ${x(124)} 28`,
    `L ${x(130)} 156`,
    `L ${x(136)} 112`,
    `L ${x(146)} 112`,
    `C ${x(154)} 112 ${x(160)} 84 ${x(170)} 84`,
    `C ${x(180)} 84 ${x(186)} 112 ${x(CYCLE)} 112`,
  ].join(" ");
}

function waveformPath(): string {
  let d = `M 0 112`;
  for (let i = 0; i < BEATS; i += 1) d += ` ${beat(i * CYCLE)}`;
  return d;
}

const PATH_D = waveformPath();

/**
 * Cardiac-monitor trace: the path stays fixed while a sweep draws P-QRS-T beats
 * behind a leading point and leaves the previous sweep ahead of a short gap.
 */
export function AnimatedEkg() {
  const reactId = useId().replace(/:/g, "");
  const gradId = `rc-ekg-grad-${reactId}`;
  const stageRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<SVGPathElement>(null);
  const midRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const core = coreRef.current;
    const dot = dotRef.current;
    if (!stage || !core || !dot) return;

    const mid = midRef.current;
    const glow = glowRef.current;
    const len = core.getTotalLength();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    const paint = (dash: string) => {
      core.style.strokeDasharray = dash;
      if (mid) mid.style.strokeDasharray = dash;
      if (glow) glow.style.strokeDasharray = dash;
    };

    const showStatic = () => {
      paint("none");
      dot.style.opacity = "0";
    };

    const frame = (now: number) => {
      if (media.matches) {
        showStatic();
        return;
      }
      const fast = stage.closest(".rc-ekg-layer")?.classList.contains("rc-ekg-authenticating");
      const period = ((BEATS * 60) / BPM) * 1000 * (fast ? 0.72 : 1);
      const head = ((now % period) / period) * len;
      const gap = len * 0.045;
      const gapLen = Math.min(gap, Math.max(len - head, 0));
      const rest = Math.max(len - head - gapLen, 0);
      paint(`${head} ${gapLen} ${rest} ${len}`);

      const pt = core.getPointAtLength(Math.min(Math.max(head, 0), Math.max(len - 0.5, 0)));
      const width = stage.clientWidth || 1;
      const height = stage.clientHeight || 1;
      dot.style.opacity = "1";
      dot.style.transform = `translate(${(pt.x / VIEW_W) * width}px, ${(pt.y / VIEW_H) * height}px)`;
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (media.matches) {
        showStatic();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    start();
    media.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      media.removeEventListener("change", start);
    };
  }, []);

  return (
    <div ref={stageRef} className="rc-ekg-stage">
      <svg className="rc-ekg-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VIEW_W} y2="0">
            <stop offset="0%" stopColor="#E31B36" />
            <stop offset="46%" stopColor="#FFFFFF" />
            <stop offset="54%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#168BFF" />
          </linearGradient>
        </defs>
        <path ref={glowRef} className="rc-ekg-stroke rc-ekg-stroke--glow" d={PATH_D} stroke={`url(#${gradId})`} />
        <path ref={midRef} className="rc-ekg-stroke rc-ekg-stroke--mid" d={PATH_D} stroke={`url(#${gradId})`} />
        <path ref={coreRef} className="rc-ekg-stroke rc-ekg-stroke--core" d={PATH_D} stroke={`url(#${gradId})`} />
      </svg>
      <span ref={dotRef} className="rc-ekg-dot" />
    </div>
  );
}
