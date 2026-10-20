"use client";

import { useEffect, useState } from "react";
import { AnimatedEkg } from "@/components/auth/animated-ekg";

export type PulseState = "idle" | "authenticating" | "success";

type RapidCortexPulseProps = {
  state?: PulseState;
  onSuccessComplete?: () => void;
  className?: string;
};

/**
 * Full-bleed traveling EKG for the agency login atmosphere.
 * Idle → 8s sweep; authenticating → faster; success → one bright sweep, then navigate.
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

  return (
    <div
      className={[
        "rc-ekg-layer",
        `rc-ekg-${state}`,
        successPulse ? "rc-ekg-success-active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <AnimatedEkg />
    </div>
  );
}
