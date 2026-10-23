"use client";

import { useEffect, useState } from "react";
import { isBusinessCardsUiEnabled } from "@/lib/runtime-flags";

/** True only after the tenant status call says business cards are enabled. */
export function useBusinessCardTenantEnabled(agencyId?: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (agencyId !== "__platform__" || !isBusinessCardsUiEnabled()) return;
    const read = () => {
      try {
        const raw = window.sessionStorage.getItem("bizCardStatus");
        const parsed = raw ? (JSON.parse(raw) as { enabled?: boolean }) : null;
        setEnabled(Boolean(parsed?.enabled));
      } catch {
        setEnabled(false);
      }
    };
    read();
    window.addEventListener("rc-bizcard-status", read);
    void fetch("/api/business-cards/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((status: { enabled?: boolean } | null) => {
        if (!status) return;
        window.sessionStorage.setItem("bizCardStatus", JSON.stringify(status));
        window.dispatchEvent(new CustomEvent("rc-bizcard-status", { detail: status }));
      })
      .catch(() => undefined);
    return () => window.removeEventListener("rc-bizcard-status", read);
  }, [agencyId]);

  return enabled;
}

export function omitBusinessCardsUntilEnabled<T extends { sections: Array<{ id: string }> }>(
  nav: T,
  enabled: boolean,
): T {
  if (enabled) return nav;
  return { ...nav, sections: nav.sections.filter((section) => section.id !== "business-cards") };
}
