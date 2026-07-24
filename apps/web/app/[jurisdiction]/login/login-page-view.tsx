import Image from "next/image";
import type { LoginQuerySnapshot } from "@/lib/auth/login-query";
import { isHostedUiAuthConfigured } from "@/lib/auth/roles";
import { marketingHomePath } from "@/lib/marketing-links";
import {
  SITE_LOGO_HEIGHT,
  SITE_LOGO_PATH,
  SITE_LOGO_WIDTH,
  SITE_NAME,
} from "@/lib/site";
import { LoginForm } from "./login-form";

export function LoginPageView({
  loginQuery,
}: {
  /** Kept for callers (`/login`, `/{jurisdiction}/login`); layout no longer branches on it. */
  jurisdiction: string;
  loginQuery: LoginQuerySnapshot;
}) {
  /** true when ECS `COGNITO_*` and/or baked `NEXT_PUBLIC_COGNITO_*` are present (SSR reads runtime env when dynamic). */
  const signInConfigured = isHostedUiAuthConfigured();
  const year = new Date().getFullYear();

  return (
    <main className="rc-login-page">
      <div className="rc-login-page__grid" aria-hidden />
      <div className="rc-login-page__glow-blue" aria-hidden />
      <div className="rc-login-page__glow-red" aria-hidden />
      <div className="rc-login-page__scan" aria-hidden />

      <div className="rc-login-page__column">
        <header className="rc-login-brand">
          <a href={marketingHomePath()} aria-label={`${SITE_NAME} home`}>
            <Image
              src={SITE_LOGO_PATH}
              alt={SITE_NAME}
              width={SITE_LOGO_WIDTH}
              height={SITE_LOGO_HEIGHT}
              priority
              unoptimized
              className="rc-login-brand__logo mx-auto h-12 w-auto max-w-[200px]"
            />
          </a>
          <div className="rc-login-brand__wordmark" aria-hidden>
            <span className="rc-login-brand__wordmark-rapid">Rapid</span>
            <span className="rc-login-brand__wordmark-cortex">Cortex</span>
          </div>
          <p className="rc-login-brand__tagline">Intelligence at the speed of response</p>
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

        <LoginForm loginQuery={loginQuery} signInConfigured={signInConfigured} />

        <p className="rc-login-page__copyright">
          © {year} Rapid Cortex, LLC — Apps on Demand · app.rapidcortex.us
        </p>
      </div>
    </main>
  );
}
