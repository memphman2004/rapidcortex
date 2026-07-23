import {
  CHANNEL_CONFIG,
  type LeadChannel,
  type LeadVertical,
  type PipelineStage,
  type SalesLeadCrmRecord,
  STAGE_CONFIG,
} from "rapid-cortex-shared";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#1d4ed8,#7c3aed)",
  "linear-gradient(135deg,#0e7490,#0f766e)",
  "linear-gradient(135deg,#b45309,#b91c1c)",
  "linear-gradient(135deg,#7c3aed,#db2777)",
  "linear-gradient(135deg,#15803d,#0369a1)",
] as const;

export function getAvatarGradient(email: string): string {
  const hash = email.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]!;
}

export function leadDisplayName(lead: SalesLeadCrmRecord): string {
  const fromParts = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  if (lead.name?.trim()) return lead.name.trim();
  return lead.email;
}

export function leadInitials(lead: SalesLeadCrmRecord): string {
  const name = leadDisplayName(lead);
  if (name.includes("@")) return name.charAt(0).toUpperCase();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase() || "?";
}

export function leadAgency(lead: SalesLeadCrmRecord): string {
  return lead.agencyName?.trim() || lead.agencyCompany?.trim() || "";
}

export function resolveLeadChannel(lead: SalesLeadCrmRecord): LeadChannel {
  if (lead.attribution?.channel) return lead.attribution.channel;
  const src = String(lead.source ?? "").toLowerCase();
  if (src.includes("ring")) return "ring_waitlist";
  if (src.includes("contact") || src.includes("sales") || src.includes("demo")) return "contact_sales";
  if (src.includes("cortex") || src.includes("newsletter") || src.includes("inside")) {
    return "inside_the_cortex";
  }
  if (src.includes("linkedin")) return "linkedin";
  if (src.includes("referral")) return "referral";
  if (src.includes("organic") || src.includes("search")) return "organic_search";
  if (src.includes("direct")) return "direct";
  return "other";
}

export function channelShortLabel(channel: LeadChannel): string {
  if (channel === "ring_waitlist") return "RING";
  if (channel === "contact_sales") return "SALES";
  if (channel === "inside_the_cortex") return "CORTEX";
  return CHANNEL_CONFIG[channel].label.toUpperCase().slice(0, 8);
}

export function channelBadgeClass(channel: LeadChannel): string {
  if (channel === "ring_waitlist") return "bg-emerald-500/10 text-emerald-300";
  if (channel === "contact_sales") return "bg-sky-500/10 text-sky-300";
  if (channel === "inside_the_cortex") return "bg-violet-500/10 text-violet-300";
  if (channel === "organic_search") return "bg-yellow-500/10 text-yellow-300";
  return "bg-slate-500/10 text-slate-400";
}

export function verticalLabel(vertical?: LeadVertical | null): string {
  switch (vertical) {
    case "rc911":
      return "RC 911";
    case "campus":
      return "Campus";
    case "venue":
      return "Venue";
    case "hospital":
      return "Hospital";
    case "transit":
      return "Transit";
    default:
      return "Unknown";
  }
}

export function formatCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value).toLocaleString()}`;
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function stageBadgeClasses(stage: PipelineStage): string {
  const cfg = STAGE_CONFIG[stage];
  return `${cfg.bgClass} ${cfg.textClass}`;
}

/** 0 = fresh, 1 = amber (≥5d), 2 = red (≥14d or never contacted). */
export function staleLevel(lead: SalesLeadCrmRecord): 0 | 1 | 2 {
  if (!lead.lastContactedAt) return 2;
  const days = (Date.now() - new Date(lead.lastContactedAt).getTime()) / 86_400_000;
  if (days >= 14) return 2;
  if (days >= 5) return 1;
  return 0;
}

export function relTime(d?: string | null): string | null {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function isOverdue(d?: string | null): boolean {
  return !!d && new Date(d) < new Date();
}

export function isDueSoon(d?: string | null): boolean {
  if (!d) return false;
  const ms = new Date(d).getTime() - Date.now();
  return ms > 0 && ms < 3 * 86_400_000;
}

export function matchesSearch(lead: SalesLeadCrmRecord, q: string): boolean {
  if (!q.trim()) return true;
  const hay = [
    lead.email,
    lead.name,
    lead.firstName,
    lead.lastName,
    lead.agencyName,
    lead.agencyCompany,
    lead.phone,
    lead.title,
    lead.assignedToName,
    lead.nextAction,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

export type SourceFilter = "all" | "ring_waitlist" | "contact_sales" | "inside_the_cortex";

export function matchesSourceFilter(lead: SalesLeadCrmRecord, filter: SourceFilter): boolean {
  if (filter === "all") return true;
  return resolveLeadChannel(lead) === filter;
}

export type VerticalFilter = "all" | LeadVertical;

export function matchesVerticalFilter(lead: SalesLeadCrmRecord, filter: VerticalFilter): boolean {
  if (filter === "all") return true;
  return (lead.vertical ?? "unknown") === filter;
}

export function flattenPipeline(
  stages: Record<PipelineStage, SalesLeadCrmRecord[]>,
): SalesLeadCrmRecord[] {
  return Object.values(stages).flat();
}
