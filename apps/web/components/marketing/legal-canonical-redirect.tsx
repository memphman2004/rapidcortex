"use client";

import { useEffect } from "react";

/** Client redirect for static-export marketing pages (Next `redirect()` is not available). */
export function LegalCanonicalRedirect({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <p className="rounded-lg border border-sky-800/40 bg-sky-950/20 p-4 text-slate-200">
      Redirecting to the{" "}
      <a href={href} className="font-medium text-sky-400 hover:text-sky-300">
        {label}
      </a>
      …
    </p>
  );
}
