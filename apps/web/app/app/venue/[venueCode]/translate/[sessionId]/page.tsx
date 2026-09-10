"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { TranslateSessionPageClient } from "@/components/translate/TranslateSessionPageClient";

export default function VenueTranslateSessionPage() {
  const params = useParams<{ venueCode: string; sessionId: string }>();
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading translation…</p>}>
      <TranslateSessionPageClient
        sessionId={params.sessionId}
        vertical="venue"
        heading="RC Translate"
        createRequest={{ vertical: "venue", venueContext: { venueCode: params.venueCode } }}
      />
    </Suspense>
  );
}
