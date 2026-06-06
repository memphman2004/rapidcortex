import Link from "next/link";
import { isPublicSignupUiEnabled } from "@/lib/auth/public-signup";
import { MarketingBookAppointmentLink } from "@/components/marketing/marketing-book-appointment-link";
import { marketingContactPath, marketingSignupPath } from "@/lib/marketing-links";

export function MarketingPilotResourcesStrip() {
  const signup = marketingSignupPath();
  const contact = marketingContactPath();
  const signupEnabled = isPublicSignupUiEnabled();

  return (
    <section className="border-t border-slate-800/80 bg-slate-950/50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-base font-semibold tracking-tight text-sky-400/90 sm:text-lg">
          Agency Pilot & Evaluation
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Evaluate Rapid Cortex in a guided pilot built for public safety teams. Each pilot includes a defined technical
          scope, onboarding support, success criteria, and clear operational boundaries so your agency can assess impact
          with confidence.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          After secure access is provisioned, authorized agency administrators can manage the pilot workspace, track
          onboarding progress, and coordinate evaluation activities inside the Rapid Cortex console.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={contact}
            className="inline-flex items-center justify-center rounded-md border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-500"
          >
            Contact us
          </Link>
          <MarketingBookAppointmentLink className="inline-flex items-center justify-center rounded-md border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-500">
            Book appointment
          </MarketingBookAppointmentLink>
          {signupEnabled ? (
            <Link
              href={signup}
              className="inline-flex items-center justify-center rounded-md border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-500"
            >
              Sign up
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
