"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function CardAnalytics({ publicProfileId }: { publicProfileId: string }) {
  const search = useSearchParams();
  useEffect(() => {
    const raw = search.get("src");
    const sourceType = raw === "nfc" || raw === "qr" || raw === "share" ? (raw === "share" ? "shared_link" : raw) : "unknown";
    void fetch(`/api/public/business-cards/${publicProfileId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "page_view", sourceType }),
    }).catch(() => undefined);
  }, [publicProfileId, search]);
  return null;
}
