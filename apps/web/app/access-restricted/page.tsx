import { Suspense } from "react";
import { AccessRestrictedClient } from "./access-restricted-client";

function LoadingFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-slate-300">
      <p className="text-sm">Loading…</p>
    </div>
  );
}

export default function AccessRestrictedPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AccessRestrictedClient />
    </Suspense>
  );
}
