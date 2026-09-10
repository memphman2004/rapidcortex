"use client";

import { useParams } from "next/navigation";
import { useSession } from "@/components/auth/session-context";
import { TranslateHomeClient } from "@/components/translate/TranslateHomeClient";
import { canStartTranslateSessionCampus } from "@/lib/translate/translate-authz";

export default function CampusTranslatePage() {
  const params = useParams<{ campusCode: string }>();
  const code = params.campusCode;
  const { user } = useSession();
  const allowStart = !user || canStartTranslateSessionCampus(user, user.agencyId);
  return (
    <TranslateHomeClient
      vertical="campus"
      heading="RC Translate"
      campusCode={code}
      allowStart={allowStart}
      sessionHref={(id) =>
        allowStart
          ? `/app/campus/${code}/translate/${id}`
          : `/app/campus/${code}/translate/${id}?monitor=1`
      }
    />
  );
}
