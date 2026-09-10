"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { TranslateSessionPageClient } from "@/components/translate/TranslateSessionPageClient";
import { useSession } from "@/components/auth/session-context";

export default function HospitalAdminTranslateSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const { user } = useSession();
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading translation…</p>}>
      <TranslateSessionPageClient
        sessionId={params.sessionId}
        vertical="hospital"
        heading="RC Translate — Clinical"
        createRequest={{
          vertical: "hospital",
          hospitalContext: { hospitalId: user?.hospitalId || user?.agencyId || "hospital" },
        }}
      />
    </Suspense>
  );
}
