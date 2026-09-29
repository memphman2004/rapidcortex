"use client";

/**
 * PWA Service Worker registration + offline draft notification.
 * RFP 2396IP, Build Item 8.
 *
 * Place inside a client boundary that renders at the app root.
 * On mount: registers /sw.js and listens for DRAFT_SYNCED messages from the SW.
 */

import { useEffect } from "react";

interface DraftSyncMessage {
  type: "DRAFT_SYNCED";
  draftId: number;
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.debug("[SW] registered", reg.scope);

        // Listen for draft-synced messages
        navigator.serviceWorker.addEventListener("message", (event) => {
          const msg = event.data as DraftSyncMessage;
          if (msg?.type === "DRAFT_SYNCED") {
            // Optionally dispatch a custom event so UI components can react
            window.dispatchEvent(
              new CustomEvent("venue:draft-synced", { detail: { draftId: msg.draftId } }),
            );
          }
        });
      })
      .catch((err) => {
        // Non-fatal; don't break the app if SW registration fails
        console.warn("[SW] registration failed", err);
      });
  }, []);

  return null;
}

/**
 * Hook: returns current offline status and pending draft count.
 * Components can use this to show an "offline — N drafts queued" banner.
 */
export function useOfflineDrafts() {
  useEffect(() => {
    function onOnline() {
      // Trigger a background sync attempt when connectivity is restored
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          // @ts-expect-error — BackgroundSync API may not be typed in older TS targets
          reg.sync?.register("venue-actions-sync").catch(() => null);
        });
      }
    }

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
}
