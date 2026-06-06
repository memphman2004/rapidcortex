"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { SITE_HERO_LOGO_HEIGHT, SITE_HERO_LOGO_PATH, SITE_HERO_LOGO_WIDTH } from "@/lib/site";

/**
 * Orthogonal / branching “circuit trace” paths (viewBox `0 0 1600 640`) — matches the
 * wordless mark: HV segments, occasional 45° legs, radiating from the hub toward both edges.
 */
export const NEURAL_BRAIN_HERO_DEFAULT_PATHS: readonly {
  id: string;
  d: string;
  duration: number;
  dashPattern: string;
}[] = [
  {
    id: "pcb-u-l",
    d: "M 799 278 L 688 278 L 688 196 L 436 196 L 436 152 L 0 152",
    duration: 2.8,
    dashPattern: "7 96",
  },
  {
    id: "pcb-u-r",
    d: "M 801 278 L 912 278 L 912 196 L 1164 196 L 1164 152 L 1600 152",
    duration: 2.8,
    dashPattern: "7 96",
  },
  {
    id: "pcb-m-l",
    d: "M 799 284 L 728 284 L 728 332 L 504 332 L 504 412 L 208 412 L 208 448 L 0 448",
    duration: 3.2,
    dashPattern: "8 104",
  },
  {
    id: "pcb-m-r",
    d: "M 801 284 L 872 284 L 872 332 L 1096 332 L 1096 412 L 1392 412 L 1392 448 L 1600 448",
    duration: 3.2,
    dashPattern: "8 104",
  },
  {
    id: "pcb-l-l",
    d: "M 799 290 L 706 290 L 706 252 L 528 252 L 528 168 L 332 168 L 332 92 L 96 92 L 96 56 L 0 56",
    duration: 3.2,
    dashPattern: "6 108",
  },
  {
    id: "pcb-l-r",
    d: "M 801 290 L 894 290 L 894 252 L 1072 252 L 1072 168 L 1268 168 L 1268 92 L 1504 92 L 1504 56 L 1600 56",
    duration: 3.2,
    dashPattern: "6 108",
  },
  {
    id: "pcb-d-l",
    d: "M 799 276 L 624 276 L 624 318 L 392 318 L 392 248 L 172 248 L 172 304 L 0 312",
    duration: 2.8,
    dashPattern: "7 100",
  },
  {
    id: "pcb-d-r",
    d: "M 801 276 L 976 276 L 976 318 L 1208 318 L 1208 248 L 1428 248 L 1428 304 L 1600 312",
    duration: 2.8,
    dashPattern: "7 100",
  },
  {
    id: "pcb-diag-l",
    d: "M 799 282 L 652 282 L 652 308 L 536 308 L 496 352 L 364 352 L 324 396 L 132 396 L 92 438 L 0 438",
    duration: 3.6,
    dashPattern: "8 112",
  },
  {
    id: "pcb-diag-r",
    d: "M 801 282 L 948 282 L 948 308 L 1064 308 L 1104 352 L 1236 352 L 1276 396 L 1468 396 L 1508 438 L 1600 438",
    duration: 3.6,
    dashPattern: "8 112",
  },
  {
    id: "pcb-v-up",
    d: "M 800 276 L 800 96 L 928 96 L 928 44 L 1180 44 L 1180 0",
    duration: 2.4,
    dashPattern: "6 72",
  },
  {
    id: "pcb-v-dn",
    d: "M 800 288 L 800 520 L 672 520 L 672 588 L 420 588 L 420 640",
    duration: 2.4,
    dashPattern: "6 80",
  },
  {
    id: "pcb-v-dn-r",
    d: "M 800 288 L 800 520 L 928 520 L 928 588 L 1180 588 L 1180 640",
    duration: 2.4,
    dashPattern: "6 80",
  },
  {
    id: "pcb-b-l",
    d: "M 799 286 L 714 286 L 714 368 L 452 368 L 452 300 L 268 300 L 268 372 L 0 384",
    duration: 3.6,
    dashPattern: "9 118",
  },
  {
    id: "pcb-b-r",
    d: "M 801 286 L 886 286 L 886 368 L 1148 368 L 1148 300 L 1332 300 L 1332 372 L 1600 384",
    duration: 3.6,
    dashPattern: "9 118",
  },
];

export type NeuralBrainHeroColors = {
  fieldWash: string;
  line: string;
  lineAccent: string;
  pulse: string;
  pulseSoft: string;
  wavePrimary: string;
  waveSoft: string;
  node: string;
  nodeBright: string;
};

const DEFAULT_COLORS: NeuralBrainHeroColors = {
  fieldWash: "rgba(2, 6, 23, 0.5)",
  /** Frost-white trace like the mark’s internal lines */
  line: "rgba(248, 250, 252, 0.38)",
  lineAccent: "rgba(56, 189, 248, 0.14)",
  pulse: "rgba(255, 255, 255, 0.45)",
  pulseSoft: "rgba(186, 230, 253, 0.2)",
  wavePrimary: "rgba(224, 242, 254, 0.42)",
  waveSoft: "rgba(125, 211, 252, 0.18)",
  node: "rgba(248, 250, 252, 0.55)",
  nodeBright: "rgba(255, 255, 255, 0.78)",
};

/** Junction / endpoint dots on traces (corners & screen edges). */
const NODE_POINTS: readonly [number, number][] = [
  [436, 196],
  [0, 152],
  [504, 332],
  [0, 448],
  [332, 168],
  [0, 56],
  [392, 318],
  [0, 312],
  [364, 352],
  [0, 438],
  [1164, 196],
  [1600, 152],
  [1096, 332],
  [1600, 448],
  [1268, 168],
  [1600, 56],
  [1208, 318],
  [1600, 312],
  [1236, 352],
  [1600, 438],
  [1180, 0],
  [420, 640],
  [1180, 640],
  [800, 96],
  [688, 278],
  [912, 278],
];

/** Clip EEG bands outside a center reserve for the logo (viewBox coords). */
const WAVE_INNER_LEFT = 668;
const WAVE_INNER_RIGHT = 932;

function buildWaveSegment(
  fromX: number,
  toX: number,
  y: number,
  wavelength: number,
  amplitude: number,
  style: "smooth" | "jagged",
): string {
  const towardRight = toX >= fromX;
  let x = fromX;
  let d = `M ${fromX.toFixed(1)} ${y.toFixed(1)}`;
  const step = style === "jagged" ? Math.max(2.5, wavelength / 10) : wavelength / 4;
  let i = 0;
  const limit = 500;
  while (i < limit) {
    const nextX = towardRight ? Math.min(toX, x + step) : Math.max(toX, x - step);
    if (Math.abs(nextX - x) < 0.01) break;
    const mid = (x + nextX) / 2;
    if (style === "jagged") {
      const flip = i % 2 === 0 ? amplitude * 0.55 : -amplitude * 0.55;
      d += ` L ${nextX.toFixed(1)} ${(y + flip).toFixed(1)}`;
    } else {
      const ctrl = y + (i % 2 === 0 ? amplitude : -amplitude);
      d += ` Q ${mid.toFixed(1)} ${ctrl.toFixed(1)} ${nextX.toFixed(1)} ${y.toFixed(1)}`;
    }
    x = nextX;
    i++;
    if (towardRight ? x >= toX - 0.01 : x <= toX + 0.01) break;
  }
  return d;
}

/** Repeating wave along x; used for seamless translate loop. */
function buildWaveRepeat(
  xStart: number,
  xEnd: number,
  y: number,
  wavelength: number,
  amplitude: number,
  style: "smooth" | "jagged",
): { d: string; period: number } {
  const len = Math.abs(xEnd - xStart);
  const periods = Math.max(2, Math.ceil(len / wavelength));
  const towardRight = xEnd >= xStart;
  const actualEnd = towardRight ? xStart + periods * wavelength : xStart - periods * wavelength;
  const d = buildWaveSegment(xStart, actualEnd, y, wavelength, amplitude, style);
  return { d, period: periods * wavelength };
}

type WaveBand = {
  id: string;
  y: number;
  wavelength: number;
  amplitude: number;
  style: "smooth" | "jagged";
  strokeWidth: number;
  opacity: number;
  duration: number;
};

const WAVE_BANDS: readonly WaveBand[] = [
  /* gamma-ish — dense */
  { id: "g", y: 212, wavelength: 10, amplitude: 2.8, style: "jagged", strokeWidth: 0.85, opacity: 0.55, duration: 1.35 },
  { id: "b", y: 232, wavelength: 16, amplitude: 3.6, style: "jagged", strokeWidth: 0.95, opacity: 0.62, duration: 1.75 },
  /* alpha */
  { id: "a", y: 258, wavelength: 36, amplitude: 5.2, style: "smooth", strokeWidth: 1.05, opacity: 0.68, duration: 2.5 },
  /* theta */
  { id: "t", y: 286, wavelength: 56, amplitude: 7.2, style: "smooth", strokeWidth: 1.1, opacity: 0.55, duration: 3.75 },
  /* delta */
  { id: "d", y: 314, wavelength: 88, amplitude: 9.5, style: "smooth", strokeWidth: 1.15, opacity: 0.48, duration: 5.25 },
];

function detectLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const deviceMemory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : 8;
  return deviceMemory <= 4 || cores <= 4;
}

function HeroEegWaves({
  prefersReducedMotion,
  waveStroke,
  waveStrokeSoft,
  clipLeftId,
  clipRightId,
  waveSpeed,
  bands,
}: {
  prefersReducedMotion: boolean;
  waveStroke: string;
  waveStrokeSoft: string;
  clipLeftId: string;
  clipRightId: string;
  /** 1 = default; >1 slows EEG scroll (e.g. calmer hero). */
  waveSpeed: number;
  bands: readonly WaveBand[];
}) {
  return (
    <g>
      <defs>
        <clipPath id={clipLeftId}>
          <rect x="0" y="96" width={WAVE_INNER_LEFT} height="448" />
        </clipPath>
        <clipPath id={clipRightId}>
          <rect x={WAVE_INNER_RIGHT} y="96" width={1600 - WAVE_INNER_RIGHT} height="448" />
        </clipPath>
      </defs>

      {bands.map((band) => {
        const left = buildWaveRepeat(WAVE_INNER_LEFT, WAVE_INNER_LEFT - 880, band.y, band.wavelength, band.amplitude, band.style);
        const right = buildWaveRepeat(WAVE_INNER_RIGHT, WAVE_INNER_RIGHT + 880, band.y, band.wavelength, band.amplitude, band.style);
        const pL = Math.max(48, left.period);
        const pR = Math.max(48, right.period);

        return (
          <g key={`eeg-${band.id}`}>
            <g clipPath={`url(#${clipLeftId})`}>
              {!prefersReducedMotion ? (
                <motion.g
                  initial={false}
                  animate={{ x: [0, -pL] }}
                  transition={{
                    duration: band.duration * waveSpeed,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{ willChange: "transform" }}
                >
                  <path
                    d={left.d}
                    stroke={waveStroke}
                    strokeWidth={band.strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={band.opacity}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    transform={`translate(${pL},0)`}
                    d={left.d}
                    stroke={waveStrokeSoft}
                    strokeWidth={band.strokeWidth * 0.55}
                    fill="none"
                    strokeLinecap="round"
                    opacity={band.opacity * 0.45}
                    vectorEffect="non-scaling-stroke"
                  />
                </motion.g>
              ) : (
                <path
                  d={buildWaveSegment(WAVE_INNER_LEFT, 0, band.y, band.wavelength, band.amplitude, band.style)}
                  stroke={waveStrokeSoft}
                  strokeWidth={band.strokeWidth * 0.75}
                  fill="none"
                  strokeLinecap="round"
                  opacity={band.opacity * 0.35}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>

            <g clipPath={`url(#${clipRightId})`}>
              {!prefersReducedMotion ? (
                <motion.g
                  initial={false}
                  animate={{ x: [0, pR] }}
                  transition={{
                    duration: band.duration * waveSpeed,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{ willChange: "transform" }}
                >
                  <path
                    d={right.d}
                    stroke={waveStroke}
                    strokeWidth={band.strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={band.opacity}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    transform={`translate(${-pR},0)`}
                    d={right.d}
                    stroke={waveStrokeSoft}
                    strokeWidth={band.strokeWidth * 0.55}
                    fill="none"
                    strokeLinecap="round"
                    opacity={band.opacity * 0.45}
                    vectorEffect="non-scaling-stroke"
                  />
                </motion.g>
              ) : (
                <path
                  d={buildWaveSegment(WAVE_INNER_RIGHT, 1600, band.y, band.wavelength, band.amplitude, band.style)}
                  stroke={waveStrokeSoft}
                  strokeWidth={band.strokeWidth * 0.75}
                  fill="none"
                  strokeLinecap="round"
                  opacity={band.opacity * 0.35}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}

export type NeuralBrainHeroNetworkProps = {
  className?: string;
  contentClassName?: string;
  contentJustify?: "start" | "center" | "end";
  paths?: readonly { id: string; d: string; duration: number; dashPattern: string }[];
  colors?: Partial<NeuralBrainHeroColors>;
  ambientFloat?: boolean;
  readingScrim?: "landing" | "leftCopy";
  variant?: "marketing" | "inset";
  /** Center mark: Rapid Cortex logo with animated EEG-style waves when true. */
  showCenterLogo?: boolean;
  children?: ReactNode;
};

const justifyClass = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
} as const;

const contentPaddingByJustify: Record<"start" | "center" | "end", string> = {
  end: "pt-[min(40vw,300px)] sm:pt-[min(36vw,280px)] md:pt-[min(32vw,260px)] pb-14 sm:pb-20",
  center: "py-20 sm:py-24",
  start: "pt-14 pb-14 sm:pt-16 sm:pb-16",
};

export function NeuralBrainHeroNetwork({
  className = "",
  contentClassName = "",
  contentJustify = "end",
  paths = NEURAL_BRAIN_HERO_DEFAULT_PATHS,
  colors: colorOverrides,
  ambientFloat = true,
  readingScrim = "landing",
  variant = "marketing",
  showCenterLogo = true,
  children,
}: NeuralBrainHeroNetworkProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const waveClipUid = useId().replace(/:/g, "");
  const clipLeftId = `nb-wl-${waveClipUid}`;
  const clipRightId = `nb-wr-${waveClipUid}`;
  const c = useMemo(() => ({ ...DEFAULT_COLORS, ...colorOverrides }), [colorOverrides]);
  const pathList = useMemo(() => [...paths], [paths]);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [animationsReady, setAnimationsReady] = useState(false);
  useEffect(() => {
    setLowPowerMode(detectLowPowerDevice());
    setAnimationsReady(true);
  }, []);
  const waveBands = useMemo(
    () => (lowPowerMode ? WAVE_BANDS.filter((_, i) => i % 2 === 0) : WAVE_BANDS),
    [lowPowerMode],
  );
  const nodePoints = useMemo(
    () => (lowPowerMode ? NODE_POINTS.filter((_, i) => i % 2 === 0) : NODE_POINTS),
    [lowPowerMode],
  );
  const motionDisabled = prefersReducedMotion || !animationsReady;
  const sizeClass = variant === "inset" ? "min-h-0 h-full" : "min-h-[min(72vh,640px)]";
  const logoStyle: CSSProperties =
    variant === "inset"
      ? { top: "24%", width: "min(58%, 260px)", maxWidth: 260, opacity: 0.18 }
      : { top: "38%", width: "min(50vw, 360px)", maxWidth: 360, opacity: 0.18 };

  return (
    <div
      className={["relative isolate flex w-full flex-col", sizeClass, className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#071525] to-[#020617]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_42%_36%_at_50%_32%,rgba(14,165,233,0.08)_0%,transparent_72%)]"
          aria-hidden
        />
        <div className="absolute inset-0 opacity-95" style={{ backgroundColor: c.fieldWash }} aria-hidden />

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1600 640"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="nb-hub-soft" cx="50%" cy="44%" r="38%">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.1" />
              <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
            <filter id="nb-hub-blur" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <ellipse cx="800" cy="268" rx="96" ry="78" fill="url(#nb-hub-soft)" filter="url(#nb-hub-blur)" opacity="0.5" />

          {pathList.map((p) => (
            <path
              key={`nb-base-${p.id}`}
              d={p.d}
              stroke={c.line}
              strokeWidth="0.95"
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeMiterlimit="2.2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {pathList.map((p) => (
            <path
              key={`nb-accent-${p.id}`}
              d={p.d}
              stroke={c.lineAccent}
              strokeWidth="0.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeMiterlimit="2.2"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <HeroEegWaves
            prefersReducedMotion={motionDisabled}
            waveStroke={c.wavePrimary}
            waveStrokeSoft={c.waveSoft}
            clipLeftId={clipLeftId}
            clipRightId={clipRightId}
            waveSpeed={ambientFloat ? 1 : 1.2}
            bands={waveBands}
          />

          {!motionDisabled
            ? pathList.map((p, idx) => {
                /** Normalized-dash “packet” marching along orthogonal traces (`pathLength=1`). */
                const dashVisible = lowPowerMode ? "0.028 0.972" : "0.022 0.978";
                const strokeW = lowPowerMode ? 2.05 : 2.6;
                /**
                 * Framer `strokeDashoffset` is reliable across Chromium/Safari; SMIL `<animate>`
                 * often stops after hydration. Skip glow filter on moving strokes—filter + dash
                 * repaint has regressed motion to static tiles in prod Chrome.
                 */
                return (
                  <motion.path
                    key={`nb-pulse-${p.id}`}
                    d={p.d}
                    pathLength={1}
                    stroke={c.pulse}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray={dashVisible}
                    fill="none"
                    opacity={lowPowerMode ? 0.78 : 0.92}
                    initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: -1 }}
                    transition={{
                      duration: p.duration + (idx % 5) * 0.08,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    style={{ willChange: "stroke-dashoffset" }}
                  />
                );
              })
            : pathList.map((p) => (
                <path
                  key={`nb-static-${p.id}`}
                  d={p.d}
                  stroke={c.pulseSoft}
                  strokeWidth="0.8"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  strokeMiterlimit="2.2"
                  strokeDasharray={p.dashPattern}
                  strokeOpacity="0.22"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

          {nodePoints.map(([cx, cy], i) => (
            <motion.g key={`nb-node-${cx}-${cy}`}>
              <motion.circle
                cx={cx}
                cy={cy}
                r={2.35}
                fill="none"
                stroke={c.nodeBright}
                strokeWidth="0.45"
                initial={false}
                animate={
                  motionDisabled
                    ? { opacity: 0.18 }
                    : { opacity: [0.1, 0.28, 0.12] }
                }
                transition={
                  motionDisabled
                    ? {}
                    : {
                        duration: 4.2 + (i % 4) * 0.35,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.24,
                      }
                }
              />
              <motion.circle
                cx={cx}
                cy={cy}
                r={1.85}
                fill={c.node}
                initial={false}
                animate={
                  motionDisabled
                    ? { opacity: 0.35 }
                    : { opacity: [0.32, 0.55, 0.34], r: [1.75, 2.05, 1.75] }
                }
                transition={
                  motionDisabled
                    ? {}
                    : {
                        duration: 3.6 + (i % 5) * 0.22,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.17,
                      }
                }
              />
            </motion.g>
          ))}
        </svg>

        {showCenterLogo ? (
          <div
            className="pointer-events-none absolute left-1/2 z-[4] -translate-x-1/2 -translate-y-1/2"
            style={logoStyle}
            aria-hidden
          >
            <Image
              src={SITE_HERO_LOGO_PATH}
              alt=""
              width={SITE_HERO_LOGO_WIDTH}
              height={SITE_HERO_LOGO_HEIGHT}
              priority={variant === "marketing"}
              className="h-auto w-full object-contain contrast-[0.92] saturate-[0.92] drop-shadow-[0_8px_36px_rgba(0,0,0,0.4)]"
              sizes="(max-width: 640px) 64vw, 380px"
            />
          </div>
        ) : null}

        {readingScrim === "landing" ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-[3] bg-[radial-gradient(ellipse_58%_50%_at_50%_28%,transparent_0%,transparent_38%,rgba(2,6,23,0.26)_58%,rgba(2,6,23,0.55)_100%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[62%] bg-gradient-to-t from-[#020617]/96 via-[#020617]/62 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-[28%] bg-gradient-to-b from-[#020617]/45 via-transparent to-transparent"
              aria-hidden
            />
          </>
        ) : (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-r from-[#020617] via-[#020617]/82 to-[#020617]/18 md:from-[#020617] md:via-[#020617]/72 md:to-[#020617]/12"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-[#020617]/50 via-transparent to-[#020617]/28 md:to-transparent"
              aria-hidden
            />
          </>
        )}
      </div>

      {prefersReducedMotion ? (
        <div
          className={[
            "pointer-events-auto relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 text-center sm:px-6",
            contentPaddingByJustify[contentJustify],
            justifyClass[contentJustify],
            contentClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>
      ) : (
        <motion.div
          className={[
            "pointer-events-auto relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 text-center sm:px-6",
            contentPaddingByJustify[contentJustify],
            justifyClass[contentJustify],
            contentClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}
