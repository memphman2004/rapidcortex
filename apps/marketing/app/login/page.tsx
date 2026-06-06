"use client";

import Link from "next/link";
import { useEffect } from "react";
import { marketingLoginPath } from "@/lib/marketing-links";

/** Static-export fallback when users open /login on the marketing host. */
export default function MarketingLoginRedirectPage() {
  const loginHref = marketingLoginPath();

  useEffect(() => {
    window.location.replace(loginHref);
  }, [loginHref]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
      <p className="text-lg font-medium">Redirecting to Rapid Cortex sign in…</p>
      <p className="mt-4 text-sm text-slate-400">
        <Link href={loginHref} className="text-sky-400 underline-offset-4 hover:underline">
          Continue to sign in
        </Link>
      </p>
    </main>
  );
}
