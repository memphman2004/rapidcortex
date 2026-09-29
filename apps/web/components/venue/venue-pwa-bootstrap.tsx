"use client";

import { useEffect } from "react";
import { queueVenueIncidentDraft, syncVenueDraftsWhenOnline } from "@/lib/venue/venue-draft-offline";

/**
 * Registers the venue PWA service worker and flushes offline incident drafts when connectivity returns.
 */
export function VenuePwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    const onOnline = () => {
      void syncVenueDraftsWhenOnline();
      navigator.serviceWorker.controller?.postMessage({ type: "SYNC_VENUE_DRAFTS" });
    };

    window.addEventListener("online", onOnline);
    if (navigator.onLine) void syncVenueDraftsWhenOnline();

    // Expose minimal hook for future incident compose UIs
    (window as Window & { __venueQueueDraft?: typeof queueVenueIncidentDraft }).__venueQueueDraft =
      queueVenueIncidentDraft;

    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
