import Image from "next/image";
import type { LoginQuerySnapshot } from "@/lib/auth/login-query";
import { isHostedUiAuthConfigured } from "@/lib/auth/roles";
import { marketingHomePath } from "@/lib/marketing-links";
import { SITE_NAME } from "@/lib/site";
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
        {/* Green ECG trace — two tiles so the rhythm can scroll seamlessly like a live monitor */}
        <div className="rc-login-page__scan-track">
          <svg className="rc-login-page__scan-svg" viewBox="0 0 1200 36" preserveAspectRatio="none">
            <path
              className="rc-login-page__scan-path"
              d="M0 18 H48 L56 14 L64 18 H80 L92 4 L100 30 L112 18 H140 L152 12 L168 18 H220 L228 14 L236 18 H252 L264 4 L272 30 L284 18 H312 L324 12 L340 18 H392 L400 14 L408 18 H424 L436 4 L444 30 L456 18 H484 L496 12 L512 18 H564 L572 14 L580 18 H596 L608 4 L616 30 L628 18 H656 L668 12 L684 18 H736 L744 14 L752 18 H768 L780 4 L788 30 L800 18 H828 L840 12 L856 18 H908 L916 14 L924 18 H940 L952 4 L960 30 L972 18 H1000 L1012 12 L1028 18 H1080 L1088 14 L1096 18 H1112 L1124 4 L1132 30 L1144 18 H1200"
            />
          </svg>
          <svg className="rc-login-page__scan-svg" viewBox="0 0 1200 36" preserveAspectRatio="none">
            <path
              className="rc-login-page__scan-path"
              d="M0 18 H48 L56 14 L64 18 H80 L92 4 L100 30 L112 18 H140 L152 12 L168 18 H220 L228 14 L236 18 H252 L264 4 L272 30 L284 18 H312 L324 12 L340 18 H392 L400 14 L408 18 H424 L436 4 L444 30 L456 18 H484 L496 12 L512 18 H564 L572 14 L580 18 H596 L608 4 L616 30 L628 18 H656 L668 12 L684 18 H736 L744 14 L752 18 H768 L780 4 L788 30 L800 18 H828 L840 12 L856 18 H908 L916 14 L924 18 H940 L952 4 L960 30 L972 18 H1000 L1012 12 L1028 18 H1080 L1088 14 L1096 18 H1112 L1124 4 L1132 30 L1144 18 H1200"
            />
          </svg>
        </div>
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
