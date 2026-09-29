const DRAFT_DB = "rc-venue-drafts";
const DRAFT_STORE = "incident_drafts";

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "NexCort iQ", body: "New venue alert" };
  event.waitUntil(
    self.registration.showNotification(data.title || "NexCort iQ Venue Security", {
      body: data.body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/app/venue"));
});

function openDraftDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DRAFT_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listDraftsFromIdb() {
  const db = await openDraftDb();
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readonly");
    const req = tx.objectStore(DRAFT_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
}

async function deleteDraftFromIdb(id) {
  const db = await openDraftDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readwrite");
    tx.objectStore(DRAFT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function syncVenueDraftsInSw() {
  const drafts = await listDraftsFromIdb();
  for (const draft of drafts) {
    try {
      const venueCode = String(draft.venueCode || "").toUpperCase();
      const res = await fetch(`/api/venue/incidents?venueCode=${encodeURIComponent(venueCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft.payload || {}),
        credentials: "include",
      });
      if (res.ok) await deleteDraftFromIdb(draft.id);
    } catch {
      /* retry on next sync */
    }
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SYNC_VENUE_DRAFTS") {
    event.waitUntil(syncVenueDraftsInSw());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "venue-draft-sync") {
    event.waitUntil(syncVenueDraftsInSw());
  }
});

self.addEventListener("online", () => {
  syncVenueDraftsInSw().catch(() => undefined);
});
