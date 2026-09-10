"use client";

import { TranslateHomeClient } from "@/components/translate/TranslateHomeClient";
import { useSession } from "@/components/auth/session-context";

export default function HospitalAdminTranslatePage() {
  const { user } = useSession();
  return (
    <TranslateHomeClient
      vertical="hospital"
      heading="RC Translate — Clinical"
      hospitalId={user?.hospitalId || user?.agencyId}
      sessionHref={(id) => `/hospital-admin/translate/${id}`}
    />
  );
}
