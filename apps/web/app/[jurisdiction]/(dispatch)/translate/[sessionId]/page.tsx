"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { TranslateSessionPageClient } from "@/components/translate/TranslateSessionPageClient";

export default function TranslateSessionPage() {
  const params = useParams<{ jurisdiction: string; sessionId: string }>();
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading translation…</p>}>
      <TranslateSessionPageClient
        sessionId={params.sessionId}
        vertical="law_enforcement"
        heading="RC Translate"
      />
    </Suspense>
  );
}
