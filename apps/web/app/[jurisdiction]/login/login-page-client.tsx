"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import type { LoginQuerySnapshot } from "@/lib/auth/login-query";
import { marketingHomePath } from "@/lib/marketing-links";
import { SITE_NAME } from "@/lib/site";
import { LoginBackground } from "@/components/auth/login-background";
import { RapidCortexPulse, type PulseState } from "@/components/auth/rapid-cortex-pulse";
import { LoginForm } from "./login-form";

type Props = {
  loginQuery: LoginQuerySnapshot;
  signInConfigured: boolean;
  year: number;
};

/**
 * Client shell for login: owns pulse auth states and defers post-login navigation
 * until the success sweep finishes.
 */
export function LoginPageClient({ loginQuery, signInConfigured, year }: Props) {
  const [pulseState, setPulseState] = useState<PulseState>("idle");
  const pendingNavRef = useRef<(() => void) | null>(null);

  const handlePulseStateChange = useCallback((next: PulseState) => {
    setPulseState(next);
  }, []);

  const handleDeferNavigate = useCallback((navigate: () => void) => {
    pendingNavRef.current = navigate;
    setPulseState("success");
  }, []);

  const handleSuccessComplete = useCallback(() => {
    const go = pendingNavRef.current;
    pendingNavRef.current = null;
    go?.();
  }, []);

  return (
    <main className="rc-login-page">
      <LoginBackground />
      <RapidCortexPulse state={pulseState} onSuccessComplete={handleSuccessComplete} />

      <div className="rc-login-page__column">
        <header className="rc-login-brand">
          <a href={marketingHomePath()} aria-label={`${SITE_NAME} home`}>
            <Image
              src="/Logo/nexcort-iq-logo-alpha.png"
              alt={SITE_NAME}
              width={1024}
              height={682}
              priority
              unoptimized
              className="rc-login-brand__logo"
            />
          </a>
        </header>

        <div className="rc-login-status" role="status" aria-label="Security posture">
          <span className="rc-login-status__item">
            <span className="rc-login-status__dot" aria-hidden />
            Encrypted
          </span>
          <span className="rc-login-status__sep" aria-hidden>
            ·
          </span>
          <span className="rc-login-status__item">CJIS-aware</span>
          <span className="rc-login-status__sep" aria-hidden>
            ·
          </span>
          <span className="rc-login-status__item">Agency-isolated</span>
        </div>

        <LoginForm
          loginQuery={loginQuery}
          signInConfigured={signInConfigured}
          onPulseStateChange={handlePulseStateChange}
          onDeferNavigate={handleDeferNavigate}
        />

        <p className="rc-login-page__copyright">
          © {year} NexCort iQ, LLC — Apps on Demand · app.rapidcortex.us
        </p>
      </div>
    </main>
  );
}
