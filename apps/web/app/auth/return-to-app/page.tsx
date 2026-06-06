import { Suspense } from "react";
import { ReturnToAppContent } from "./return-to-app-content";

export default function ReturnToAppPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Loading…
        </div>
      }
    >
      <ReturnToAppContent />
    </Suspense>
  );
}
