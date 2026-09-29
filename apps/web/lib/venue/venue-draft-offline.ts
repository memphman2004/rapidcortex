const DB_NAME = "rc-venue-drafts";
const STORE = "incident_drafts";

export type VenueIncidentDraft = {
  id: string;
  venueCode: string;
  agencyId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueVenueIncidentDraft(draft: VenueIncidentDraft): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function listDrafts(): Promise<VenueIncidentDraft[]> {
  const db = await openDb();
  const rows = await new Promise<VenueIncidentDraft[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as VenueIncidentDraft[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
}

async function deleteDraft(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** POST queued drafts when online.
 * Best-effort: Stack 5 currently exposes GET-only for `/api/venue/incidents`.
 * Failed syncs leave drafts in IndexedDB until a create route is deployed.
 */
export async function syncVenueDraftsWhenOnline(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const drafts = await listDrafts();
  for (const draft of drafts) {
    try {
      const params = new URLSearchParams({ venueCode: draft.venueCode.toUpperCase() });
      const res = await fetch(`/api/venue/incidents?${params}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft.payload),
      });
      // Only drop on success; 404/405 mean create API not wired yet — keep draft.
      if (res.ok) await deleteDraft(draft.id);
    } catch {
      /* keep draft for next online event */
    }
  }
}
