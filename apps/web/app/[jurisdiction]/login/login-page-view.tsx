import type { LoginQuerySnapshot } from "@/lib/auth/login-query";
import { isHostedUiAuthConfigured } from "@/lib/auth/roles";
import { SiteLogoLink } from "@/components/brand/site-logo-link";
import { isDemoJurisdictionSlug, marketingHomePath } from "@/lib/marketing-links";
import { isDemoScriptedContentEnabled } from "@/lib/deployment-environment";
import { LoginForm } from "./login-form";

const ACADEMY_PLAYBACK_DISABLED_BODY =
  "Built for the moments when every second matters, Rapid Cortex helps public safety teams turn real-time information into faster, clearer decisions.";

const SIGN_IN_CONSOLE_HELPER = "Sign in to access your secure console.";

const RAPID_CORTEX_SLOGAN = "Rapid Cortex — Intelligence at the speed of response.";

/** Scripted academy playback OFF: calm body + slogan (desktop hero panel). On mobile optionally insert CTA before slogan (preferred copy order near the action). */
function AcademyPlaybackDisabledStack({
  bodyClassName,
  sloganClassName,
  ctaClassName,
  ctaPlacement,
}: {
  bodyClassName: string;
  sloganClassName: string;
  /** When set with `placement: "between_body_and_slogan"`, prints the sign-in helper between body and slogan. */
  ctaClassName?: string;
  ctaPlacement?: "between_body_and_slogan";
}) {
  const cta =
    ctaClassName && ctaPlacement === "between_body_and_slogan" ? (
      <p className={ctaClassName}>{SIGN_IN_CONSOLE_HELPER}</p>
    ) : null;

  return (
    <>
      <p className={bodyClassName}>{ACADEMY_PLAYBACK_DISABLED_BODY}</p>
      {cta}
      <p className={sloganClassName}>{RAPID_CORTEX_SLOGAN}</p>
    </>
  );
}

export function LoginPageView({
  jurisdiction,
  loginQuery,
}: {
  jurisdiction: string;
  loginQuery: LoginQuerySnapshot;
}) {
  /** true when ECS `COGNITO_*` and/or baked `NEXT_PUBLIC_COGNITO_*` are present (SSR reads runtime env when dynamic). */
  const signInConfigured = isHostedUiAuthConfigured();
  const demoSlug = isDemoJurisdictionSlug(jurisdiction);
  const scriptedDemo = isDemoScriptedContentEnabled();
  const academyWelcomeMode = demoSlug && !scriptedDemo;

  const headline = demoSlug && scriptedDemo
    ? "Demo & academy sign-in"
    : academyWelcomeMode
      ? "Welcome to Rapid Cortex."
      : "Enter the Cortex";
  const subcopyScriptedDemo =
    "This workspace is for scripted academy and stakeholder walkthroughs. Use a supported desktop browser. Operational traffic belongs in your production workspace slug.";
  const subcopyOperationalDefault =
    "Rapid Cortex delivers live incident intelligence, supervisor visibility, and operational control into one secure command environment. Use a supported desktop or laptop browser for the full experience.";

  const desktopBodyClass =
    "mx-auto mt-5 max-w-xl text-pretty text-center text-base leading-relaxed text-slate-400 md:text-lg 2xl:text-xl";
  const desktopSloganClass =
    "mx-auto mt-3 max-w-xl text-center text-xs font-normal leading-snug text-slate-500 sm:text-sm md:text-sm 2xl:text-base";

  const mobileBodyClass =
    "mx-auto mt-4 max-w-lg text-pretty text-center text-sm leading-relaxed text-slate-400 sm:text-base";
  const mobileSloganClass =
    "mx-auto mt-3 max-w-lg text-center text-xs font-normal leading-snug text-slate-500 sm:text-sm";

  const signInHelperDesktop =
    "mx-auto mb-6 max-w-md text-center text-sm font-medium leading-snug text-slate-300 sm:text-base lg:mx-0 lg:max-w-none lg:text-left";

  /** Mobile academy flow: sits between narrative body and slogan. */
  const signInHelperMobileNest =
    "mx-auto mb-5 max-w-lg text-center text-sm font-medium leading-snug text-slate-300 sm:text-base";

  return (
    <div className="flex min-h-dvh min-h-screen flex-col text-slate-100">
      <div className="grid min-h-0 min-h-dvh flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="relative hidden min-h-0 border-r border-slate-800/60 bg-slate-950/70 lg:flex lg:flex-col lg:px-10 lg:py-10 2xl:px-14">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2">
            <div className="w-full max-w-2xl text-center">
              <SiteLogoLink
                href={marketingHomePath()}
                heightClass="h-[14rem] 2xl:h-[17rem]"
                linkClassName="mb-8 flex w-full max-w-full shrink-0 justify-center"
                priority
              />
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl 2xl:text-[2.75rem]">
                {headline}
              </h1>
              {demoSlug && scriptedDemo ? (
                <p className={desktopBodyClass}>{subcopyScriptedDemo}</p>
              ) : academyWelcomeMode ? (
                <AcademyPlaybackDisabledStack bodyClassName={desktopBodyClass} sloganClassName={desktopSloganClass} />
              ) : (
                <p className={desktopBodyClass}>{subcopyOperationalDefault}</p>
              )}
            </div>
          </div>
          <p className="shrink-0 pb-2 text-center text-xs text-slate-600 2xl:text-sm">
            Public safety software · U.S. deployment posture
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-slate-950/90 px-4 py-8 sm:px-8 lg:px-10 2xl:px-12">
          <div className="w-full max-w-md lg:max-w-lg 2xl:max-w-xl">
            <div className="mb-6 flex justify-center lg:hidden">
              <SiteLogoLink
                href={marketingHomePath()}
                heightClass="h-[15rem]"
                linkClassName="inline-flex max-w-full"
                priority
              />
            </div>
            <div className="mb-8 lg:hidden">
              <h1 className="text-balance text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {headline}
              </h1>
              {demoSlug && scriptedDemo ? (
                <p className={mobileBodyClass}>{subcopyScriptedDemo}</p>
              ) : academyWelcomeMode ? (
                <AcademyPlaybackDisabledStack
                  bodyClassName={mobileBodyClass}
                  sloganClassName={mobileSloganClass}
                  ctaClassName={signInHelperMobileNest}
                  ctaPlacement="between_body_and_slogan"
                />
              ) : (
                <p className={mobileBodyClass}>{subcopyOperationalDefault}</p>
              )}
            </div>
            {academyWelcomeMode ? (
              <p className={`${signInHelperDesktop} hidden lg:block`}>{SIGN_IN_CONSOLE_HELPER}</p>
            ) : null}
            <LoginForm loginQuery={loginQuery} signInConfigured={signInConfigured} />
          </div>
        </div>
      </div>
    </div>
  );
}
