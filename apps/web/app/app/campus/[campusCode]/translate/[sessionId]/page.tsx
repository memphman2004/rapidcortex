"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/components/auth/session-context";
import { TranslateSessionPageClient } from "@/components/translate/TranslateSessionPageClient";
import { canStartTranslateSessionCampus } from "@/lib/translate/translate-authz";

export default function CampusTranslateSessionPage() {
  const params = useParams<{ campusCode: string; sessionId: string }>();
  const { user } = useSession();
  const monitor = Boolean(user && !canStartTranslateSessionCampus(user, user.agencyId));
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading translation…</p>}>
      <TranslateSessionPageClient
        sessionId={params.sessionId}
        vertical="campus"
        heading="RC Translate"
        monitor={monitor}
        createRequest={{ vertical: "campus", campusContext: { campusCode: params.campusCode } }}
      />
    </Suspense>
  );
}
