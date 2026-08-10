"use client";

import { useEffect, useState } from "react";

export type PulseState = "idle" | "authenticating" | "success";

type RapidCortexPulseProps = {
  state?: PulseState;
  onSuccessComplete?: () => void;
  className?: string;
};

/**
 * Full-bleed ECG-style pulse for the agency login atmosphere.
 * Idle → slow sweep; authenticating → faster/brighter; success → one strong sweep.
 */
export function RapidCortexPulse({
  state = "idle",
  onSuccessComplete,
  className = "",
}: RapidCortexPulseProps) {
  const [successPulse, setSuccessPulse] = useState(false);

  useEffect(() => {
    if (state !== "success") {
      setSuccessPulse(false);
      return;
    }

    setSuccessPulse(true);
    const timer = window.setTimeout(() => {
      setSuccessPulse(false);
      onSuccessComplete?.();
    }, 1100);

    return () => window.clearTimeout(timer);
  }, [state, onSuccessComplete]);

  const pathD = `
    M 0 100
    L 150 100
    L 190 100
    L 210 96
    L 225 104
    L 245 100
    L 390 100
    L 430 100
    L 450 94
    L 470 106
    L 490 100
    L 560 100
    L 585 100
    L 605 82
    L 625 118
    L 650 100
    L 720 100
    L 750 100
    L 770 72
    L 792 128
    L 815 100
    L 865 100
    L 890 100
    L 910 88
    L 930 100
    L 950 100
    L 970 48
    L 990 150
    L 1015 18
    L 1040 178
    L 1065 72
    L 1090 115
    L 1120 100
    L 1260 100
    L 1350 100
    L 1390 100
    L 1410 96
    L 1425 104
    L 1445 100
    L 1590 100
    L 1630 100
    L 1650 94
    L 1670 106
    L 1690 100
    L 1760 100
    L 1785 100
    L 1805 82
    L 1825 118
    L 1850 100
    L 1920 100
    L 1950 100
    L 1970 72
    L 1992 128
    L 2015 100
    L 2065 100
    L 2090 100
    L 2110 88
    L 2130 100
    L 2150 100
    L 2170 48
    L 2190 150
    L 2215 18
    L 2240 178
    L 2265 72
    L 2290 115
    L 2320 100
    L 2400 100
  `;

  return (
    <div
      className={[
        "rc-pulse-layer",
        `rc-pulse-${state}`,
        successPulse ? "rc-pulse-success-active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <svg className="rc-pulse-svg" viewBox="0 0 2400 200" preserveAspectRatio="none">
        <defs>
          <filter id="rapid-cortex-pulse-glow" x="-50%" y="-100%" width="200%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="rapid-cortex-pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0077c8" stopOpacity="0" />
            <stop offset="20%" stopColor="#00a8ff" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#78d7ff" stopOpacity="1" />
            <stop offset="80%" stopColor="#00a8ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0077c8" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path className="rc-pulse-path rc-pulse-path-glow" d={pathD} />
        <path className="rc-pulse-path rc-pulse-path-main" d={pathD} />
      </svg>
    </div>
  );
}
