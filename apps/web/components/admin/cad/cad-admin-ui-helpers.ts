import type { CadVendor } from "rapid-cortex-shared";

export const CAD_VENDOR_CARDS: {
  id: CadVendor;
  title: string;
  blurb: string;
  badge: "self-configure" | "vendor-support" | "license";
}[] = [
  {
    id: "motorola_premier_one",
    title: "Motorola PremierOne CAD",
    blurb: "JSON/XML webhook, self-configure",
    badge: "self-configure",
  },
  {
    id: "tyler_new_world",
    title: "Tyler New World CAD",
    blurb: "Requires Tyler support team, 2–5 days",
    badge: "vendor-support",
  },
  {
    id: "central_square",
    title: "CentralSquare CAD",
    blurb: "JSON webhook, self-configure",
    badge: "self-configure",
  },
  {
    id: "hexagon",
    title: "Hexagon I/CAD",
    blurb: "May require license add-on",
    badge: "license",
  },
  {
    id: "generic_webhook",
    title: "Generic Webhook",
    blurb: "Any HTTP CAD, requires field mapping",
    badge: "self-configure",
  },
];

export function vendorBadgeClass(vendor: string): string {
  if (vendor === "motorola_premier_one") return "border-sky-500/50 bg-sky-500/15 text-sky-100";
  if (vendor === "tyler_new_world") return "border-violet-500/50 bg-violet-500/15 text-violet-100";
  if (vendor === "central_square") return "border-emerald-500/50 bg-emerald-500/15 text-emerald-100";
  if (vendor === "hexagon") return "border-amber-500/50 bg-amber-500/15 text-amber-100";
  return "border-slate-600 bg-slate-800 text-slate-200";
}

export function statusDotClass(status: string): string {
  if (status === "active") return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]";
  if (status === "error") return "bg-rose-500";
  if (status === "testing") return "bg-amber-400";
  return "bg-slate-500";
}

export function formatRelative(iso: string | undefined): string {
  if (!iso) return "Never synced";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

export function vendorTitle(vendor: string): string {
  return CAD_VENDOR_CARDS.find((v) => v.id === vendor)?.title ?? vendor.replace(/_/g, " ");
}

export function extractCadPreview(rawBody: string): {
  cadNumber: string;
  callType: string;
  priority: string;
  location: string;
} {
  const empty = { cadNumber: "—", callType: "—", priority: "—", location: "—" };
  const t = rawBody.trim();
  if (!t) return empty;
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const flat =
      j.payload !== null && typeof j.payload === "object" && !Array.isArray(j.payload) ?
        (j.payload as Record<string, unknown>)
      : j;
    const cadNumber = String(
      flat.IncidentNumber ?? flat.cadNumber ?? flat.call_number ?? flat.incident_id ?? flat.CADNumber ?? "—",
    );
    const callType = String(
      flat.NatureCode ?? flat.incidentType ?? flat.call_type ?? flat.EventType ?? flat.nature_code ?? "—",
    );
    const priority = String(flat.Priority ?? flat.priority ?? flat.CallPriority ?? "—");
    const location = String(flat.Location ?? flat.location ?? flat.Address ?? flat.location_text ?? "—");
    return { cadNumber, callType, priority, location };
  } catch {
    const num = t.match(/<IncidentNumber>([^<]*)</i)?.[1];
    const nature = t.match(/<NatureCode>([^<]*)</i)?.[1];
    const pri = t.match(/<Priority>([^<]*)</i)?.[1];
    const addr = t.match(/<Address>([^<]*)</i)?.[1];
    return {
      cadNumber: num?.trim() || "—",
      callType: nature?.trim() || "—",
      priority: pri?.trim() || "—",
      location: addr?.trim() || "—",
    };
  }
}

export function normalizePriorityBadge(p: string): "P1" | "P2" | "P3" | "P4" | "—" {
  const u = p.toUpperCase();
  if (u === "P1" || u === "P2" || u === "P3" || u === "P4") return u;
  if (u === "1" || u === "E" || u === "EMERGENCY") return "P1";
  if (u === "2" || u === "HIGH") return "P2";
  if (u === "4" || u === "LOW") return "P4";
  if (u === "3" || u === "MEDIUM") return "P3";
  return "—";
}

export function priorityBadgeClass(p: "P1" | "P2" | "P3" | "P4" | "—"): string {
  if (p === "P1") return "border-rose-500/60 bg-rose-500/15 text-rose-100";
  if (p === "P2") return "border-amber-500/60 bg-amber-500/15 text-amber-100";
  if (p === "P3") return "border-sky-500/60 bg-sky-500/15 text-sky-100";
  if (p === "P4") return "border-slate-500/60 bg-slate-600/40 text-slate-200";
  return "border-slate-600 bg-slate-800 text-slate-300";
}

export function vendorTroubleshootingBullets(vendor: string): string[] {
  if (vendor === "motorola_premier_one") {
    return [
      "Confirm PremierOne outbound HTTPS is allowed to your Rapid Cortex API host.",
      "JSON and XML bodies are accepted; match Content-Type when sending XML.",
      "Use header X-RC-Token with the issued secret; optional HMAC X-RC-Signature for integrity.",
    ];
  }
  if (vendor === "tyler_new_world") {
    return [
      "Tyler often requires their PSAP team to enable the feed — plan 2–5 business days.",
      "Validate API base URL and agency code with Tyler before go-live.",
    ];
  }
  if (vendor === "central_square") {
    return [
      "Confirm the CAD export user can reach the public webhook URL over TLS 1.2+.",
      "CentralSquare field names vary by version — use generic mapping if payloads differ.",
    ];
  }
  if (vendor === "hexagon") {
    return [
      "I/CAD integrations may require an additional vendor license — confirm with Hexagon.",
    ];
  }
  return [
    "Use field mapping in integration config for non-standard JSON shapes.",
    "Send a test from the wizard and verify a row appears under Recent incidents.",
  ];
}
