"use client";

import Link from "next/link";
import { useEffect } from "react";
import { marketingSignupPath } from "@/lib/marketing-links";

/** Static-export fallback when users open /signup on the marketing host. */
export default function MarketingSignupRedirectPage() {
  const signupHref = marketingSignupPath();

  useEffect(() => {
    window.location.replace(signupHref);
  }, [signupHref]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
      <p className="text-lg font-medium">Redirecting to Rapid Cortex sign up…</p>
      <p className="mt-4 text-sm text-slate-400">
        <Link href={signupHref} className="text-sky-400 underline-offset-4 hover:underline">
          Continue to create your account
        </Link>
      </p>
    </main>
  );
}
