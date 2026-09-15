import {
  CHANNEL_LABELS,
  TICKET_STATUS_CONFIG,
  type SupportChannel,
  type SupportTicketRecord,
  type TicketStatus,
} from "rapid-cortex-shared";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#1d4ed8,#7c3aed)",
  "linear-gradient(135deg,#0e7490,#0f766e)",
  "linear-gradient(135deg,#b45309,#b91c1c)",
  "linear-gradient(135deg,#7c3aed,#db2777)",
  "linear-gradient(135deg,#15803d,#0369a1)",
] as const;

export function getAvatarGradient(seed: string): string {
  const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]!;
}

export function ticketInitials(ticket: SupportTicketRecord): string {
  const name = ticket.submittedByName?.trim() || ticket.submittedByEmail;
  if (name.includes("@")) return name.charAt(0).toUpperCase();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase() || "?";
}

export function channelShortLabel(channel: SupportChannel): string {
  if (channel === "web_form") return "WEB";
  if (channel === "phone") return "PHONE";
  return CHANNEL_LABELS[channel]?.toUpperCase().slice(0, 8) ?? channel.toUpperCase();
}

export function channelBadgeClass(channel: SupportChannel): string {
  if (channel === "web_form") return "bg-sky-500/10 text-sky-300";
  if (channel === "phone") return "bg-emerald-500/10 text-emerald-300";
  return "bg-slate-500/10 text-slate-400";
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

export function relTime(d?: string | null): string | null {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function statusBadgeClasses(status: TicketStatus): string {
  const cfg = TICKET_STATUS_CONFIG[status];
  return `${cfg.bgClass} ${cfg.textClass}`;
}

export function openAgeHours(ticket: SupportTicketRecord): number {
  return Math.max(0, Math.round((Date.now() - new Date(ticket.createdAt).getTime()) / 3_600_000));
}

export function matchesTicketSearch(ticket: SupportTicketRecord, q: string): boolean {
  if (!q.trim()) return true;
  const hay = [
    ticket.ticketId,
    ticket.subject,
    ticket.agencyName,
    ticket.agencyId,
    ticket.submittedByName,
    ticket.submittedByEmail,
    ticket.assignedToName,
    ticket.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

export type ChannelFilter = "all" | SupportChannel;
export type SeverityFilter = "all" | "SEV1" | "SEV2" | "SEV3" | "SEV4";

export function matchesChannelFilter(ticket: SupportTicketRecord, filter: ChannelFilter): boolean {
  if (filter === "all") return true;
  return ticket.channel === filter;
}

export function matchesSeverityFilter(ticket: SupportTicketRecord, filter: SeverityFilter): boolean {
  if (filter === "all") return true;
  return ticket.severity === filter;
}
