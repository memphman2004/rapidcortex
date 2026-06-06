"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

/** Base network polylines / curves: coordinates in 0–1200 × 0–400 viewBox; network extends rightward from left “cortex” region. */
export const NEURAL_HERO_PATHS: readonly { id: string; d: string; duration: number; dashPattern: string }[] = [
  {
    id: "trunk-a",
    d: "M 298 198 C 380 175 468 205 562 188 S 758 165 902 142 S 1120 118 1188 95",
    duration: 14,
    dashPattern: "10 140",
  },
  {
    id: "trunk-b",
    d: "M 285 228 C 392 248 482 215 598 232 S 772 268 928 228 S 1088 188 1175 168",
    duration: 18,
    dashPattern: "12 160",
  },
  {
    id: "branch-1",
    d: "M 340 165 Q 520 120 688 148 T 1024 112",
    duration: 11,
    dashPattern: "8 100",
  },
  {
    id: "branch-2",
    d: "M 365 268 Q 520 310 672 285 T 996 302",
    duration: 16,
    dashPattern: "9 120",
  },
  {
    id: "branch-3",
    d: "M 318 210 L 455 198 L 612 218 L 784 188 L 940 205 L 1095 178",
    duration: 13,
    dashPattern: "6 90",
  },
  {
    id: "branch-4",
    d: "M 352 245 C 480 255 540 275 658 248 S 820 220 974 238 S 1140 255 1185 240",
    duration: 20,
    dashPattern: "11 150",
  },
] as const;

export type NeuralHeroPalette = {
  line: string;
  pulse: string;
  pulseSoft: string;
  cortexFill: string;
  cortexStroke: string;
  node: string;
  ambient: string;
};

const DEFAULT_PALETTE: NeuralHeroPalette = {
  line: "rgba(56, 189, 248, 0.14)",
  pulse: "rgba(186, 230, 253, 0.55)",
  pulseSoft: "rgba(125, 211, 252, 0.22)",
  cortexFill: "rgba(14, 165, 233, 0.07)",
  cortexStroke: "rgba(56, 189, 248, 0.18)",
  node: "rgba(125, 211, 252, 0.35)",
  ambient: "rgba(56, 189, 248, 0.04)",
};

export type NeuralHeroBackgroundProps = {
  className?: string;
  /** Paths used for base + pulse layers (defaults to `NEURAL_HERO_PATHS`). */
  paths?: readonly { id: string; d: string; duration: number; dashPattern: string }[];
  /** Parallel pulse layers per path (1–2 recommended for performance). */
  pulseLayers?: 1 | 2;
  colors?: Partial<NeuralHeroPalette>;
};

/** Abstract left “cortex” silhouette — curved folds, not literal anatomy. */
const CORTEX_SILHOUETTE_D =
  "M 52 210 C 120 95 248 72 292 128 C 318 165 308 248 278 288 C 228 348 118 330 72 268 C 38 228 38 238 52 210 Z";

const NODE_POINTS: readonly [number, number][] = [
  [298, 198],
  [455, 198],
  [612, 218],
  [784, 188],
  [562, 188],
  [688, 148],
  [672, 285],
  [928, 228],
  [1024, 112],
];

export function NeuralHeroBackground({
  className = "",
  paths = NEURAL_HERO_PATHS,
  pulseLayers = 2,
  colors: colorOverrides,
}: NeuralHeroBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const c = { ...DEFAULT_PALETTE, ...colorOverrides };
  const pathList = [...paths];

  return (
    <div
      className={["pointer-events-none absolute inset-0 overflow-hidden", className].filter(Boolean).join(" ")}
      aria-hidden
    >
      <svg
        className="absolute inset-y-0 right-0 h-full w-[min(140%,1100px)] max-w-none translate-x-[8%] sm:translate-x-[4%] md:w-[min(125%,1200px)]"
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMaxYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Abstract cortex mass — left */}
        <path d={CORTEX_SILHOUETTE_D} fill={c.cortexFill} stroke={c.cortexStroke} strokeWidth="1" opacity="0.95" />
        <path
          d="M 118 168 C 168 118 228 108 268 138 M 138 238 C 188 218 238 228 268 248 M 98 210 C 158 190 218 200 258 218"
          stroke={c.cortexStroke}
          strokeWidth="0.75"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Base network — thin infrastructure */}
        {pathList.map((p) => (
          <path
            key={`base-${p.id}`}
            d={p.d}
            stroke={c.line}
            strokeWidth="1.05"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Traveling pulses — duplicated paths with dash animation */}
        {!prefersReducedMotion
          ? pathList.flatMap((p) =>
              Array.from({ length: pulseLayers }, (_, layer) => (
                <motion.path
                  key={`pulse-${p.id}-${layer}`}
                  d={p.d}
                  stroke={layer === 0 ? c.pulse : c.pulseSoft}
                  strokeWidth={layer === 0 ? 1.35 : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={p.dashPattern}
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -220 - layer * 40 }}
                  transition={{
                    duration: p.duration,
                    repeat: Infinity,
                    ease: "linear",
                    delay: layer * (p.duration / 4),
                  }}
                  opacity={layer === 0 ? 0.72 : 0.38}
                />
              )),
            )
          : null}

        {/* Static faint pulse hint when reduced motion */}
        {prefersReducedMotion
          ? pathList.map((p) => (
              <path
                key={`static-pulse-${p.id}`}
                d={p.d}
                stroke={c.pulseSoft}
                strokeWidth="1"
                strokeLinecap="round"
                strokeDasharray="4 96"
                strokeOpacity="0.35"
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}

        {/* Nodes — subtle breathing */}
        {NODE_POINTS.map(([cx, cy], i) => (
          <motion.circle
            key={`node-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={prefersReducedMotion ? 2.2 : 2.2}
            fill={c.node}
            initial={false}
            animate={
              prefersReducedMotion
                ? { opacity: 0.35 }
                : { opacity: [0.22, 0.42, 0.22], r: [2, 2.6, 2] }
            }
            transition={
              prefersReducedMotion
                ? {}
                : { duration: 3.2 + (i % 4) * 0.35, repeat: Infinity, ease: "easeInOut", delay: i * 0.22 }
            }
          />
        ))}
      </svg>

      {/* Soft vignette tying cortex to background */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_18%_50%,rgba(15,23,42,0.55)_0%,transparent_62%)]"
        aria-hidden
      />
    </div>
  );
}
