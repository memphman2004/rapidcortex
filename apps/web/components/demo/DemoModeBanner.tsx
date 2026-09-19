"use client";

import { usePathname } from "next/navigation";

function isDemoRunnerPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? "";
  return /\/demo(?:\/|$)/i.test(path);
}

/** Safety banner on demo-runner routes only — not the live supervisor/dispatcher console. */
export function DemoModeBanner() {
  const pathname = usePathname() ?? "";
  if (!isDemoRunnerPath(pathname)) return null;

  return (
    <div
      role="status"
      className="border-b border-red-500/40 bg-red-950 px-4 py-2 text-center text-xs font-semibold tracking-wide text-red-100 md:px-6"
    >
      SIMULATION MODE — NOT A REAL INCIDENT
    </div>
  );
}
