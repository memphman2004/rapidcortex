import Image from "next/image";
import type { LoginQuerySnapshot } from "@/lib/auth/login-query";
import { isHostedUiAuthConfigured } from "@/lib/auth/roles";
import { marketingHomePath } from "@/lib/marketing-links";
import { SITE_NAME } from "@/lib/site";
import { LoginEcgCanvas } from "./login-ecg-canvas";
import { LoginForm } from "./login-form";

/** Full brand lockup (icon + RAPID / CORTEX + tagline). Intrinsic 3000×2000. */
const LOGIN_LOGO_PATH = "/Logo/rapid-cortex-logo-transparent.png";
const LOGIN_LOGO_WIDTH = 3000;
const LOGIN_LOGO_HEIGHT = 2000;

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
      <div className="rc-login-page__scan" aria-hidden>
        {/* Canvas Lead II PQRST with sweep-and-erase (not CSS translateX zigzag). */}
        <LoginEcgCanvas />
      </div>

      <div className="rc-login-page__column">
        <header className="rc-login-brand">
          <a href={marketingHomePath()} aria-label={`${SITE_NAME} home`}>
            <Image
              src={LOGIN_LOGO_PATH}
              alt={SITE_NAME}
              width={LOGIN_LOGO_WIDTH}
              height={LOGIN_LOGO_HEIGHT}
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

        <LoginForm loginQuery={loginQuery} signInConfigured={signInConfigured} />

        <p className="rc-login-page__copyright">
          © {year} Rapid Cortex, LLC — Apps on Demand · app.rapidcortex.us
        </p>
      </div>
    </main>
  );
}
