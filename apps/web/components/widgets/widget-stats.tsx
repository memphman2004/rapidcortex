"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, BarChart3, Bed, Building2, Camera, Clock, CreditCard,
  DollarSign, MessageSquare, PhoneCall, QrCode, Radio, Users, Wifi,
} from "lucide-react";
import {
  fetchAgencies,
  fetchAgencyBillingInvoices,
  fetchPlatformSummary,
  fetchSupervisorActiveCalls,
} from "@/lib/api";
import { fetchLocations } from "@/lib/locations-api";
import { extractCampusCode, extractVenueCode } from "@/lib/auth/post-login-redirect";
import { fetchCampusIncidents } from "@/lib/campus/campus-incidents-api";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import { backendGet, StatCard, WidgetSkeleton, type WidgetProps } from "./widget-primitives";

function useStatQuery<T>(key: string, agencyId: string, fn: () => Promise<T>, interval = 60_000) {
  return useQuery({ queryKey: [key, agencyId, "stat"], queryFn: fn, refetchInterval: interval });
}

export function StatOpenIncidentsWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("incidents", agencyId, async () => {
    const campusCode = extractCampusCode(agencyId);
    if (agencyId.includes("campus")) {
      const rows = await fetchCampusIncidents(campusCode);
      return rows.filter((r) => ["open", "assigned", "responding"].includes(r.status)).length;
    }
    if (agencyId.includes("venue")) {
      const rows = await fetchVenueIncidents(extractVenueCode(agencyId));
      return rows.filter((r) => ["open", "assigned", "responding"].includes(r.status)).length;
    }
    const data = await backendGet<{ incidents?: unknown[] }>(
      `/api/agencies/${encodeURIComponent(agencyId)}/incidents?status=open&limit=100`,
    );
    return data?.incidents?.length ?? 0;
  }, 30_000);
  if (q.isLoading) return <WidgetSkeleton />;
  return (
    <StatCard
      label="Open incidents"
      value={q.data ?? 0}
      icon={AlertCircle}
      valueColor={(q.data ?? 0) > 0 ? "text-rose-400" : "text-white"}
    />
  );
}

export function StatActiveCallsWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("active-calls", agencyId, async () => {
    const calls = await fetchSupervisorActiveCalls().catch(() => []);
    return calls.length;
  }, 15_000);
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Active calls" value={q.data ?? 0} icon={PhoneCall} />;
}

export function StatUnitsAvailableWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("unit-status", agencyId, async () => {
    const data = await backendGet<{ available?: number; total?: number }>(
      `/api/agencies/${encodeURIComponent(agencyId)}/units/status`,
    );
    return data?.available ?? "—";
  });
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Units available" value={q.data ?? "—"} icon={Radio} />;
}

export function StatSlaAnswerTimeWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("shift-sla", agencyId, async () => {
    const data = await backendGet<{ avgAnswerTimeSeconds?: number }>(
      `/api/agencies/${encodeURIComponent(agencyId)}/sla/current`,
    );
    return data?.avgAnswerTimeSeconds != null ? `${data.avgAnswerTimeSeconds}s` : "—";
  }, 30_000);
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Avg answer time" value={q.data ?? "—"} icon={Clock} />;
}

export function StatAgencyCountWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("platform-stats", agencyId, async () => {
    const summary = await fetchPlatformSummary().catch(() => null);
    if (summary?.totals?.agencies != null) return summary.totals.agencies;
    const agencies = await fetchAgencies().catch(() => []);
    return agencies.length;
  });
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Agencies" value={q.data ?? "—"} icon={Building2} />;
}

export function StatMrrWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("billing-summary", agencyId, async () => {
    const agencies = await fetchAgencies().catch(() => []);
    const active = agencies.filter((a) => a.status === "active").length;
    return active > 0 ? `$${(active * 2400).toLocaleString()}` : "—";
  });
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Est. MRR" value={q.data ?? "—"} icon={DollarSign} />;
}

export function StatOpenInvoicesWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("billing-summary", agencyId, async () => {
    const invoices = await fetchAgencyBillingInvoices(agencyId).catch(
      (): Awaited<ReturnType<typeof fetchAgencyBillingInvoices>> => [],
    );
    return invoices.filter(
      (i) => i.state === "sent" || i.state === "partially_paid" || i.state === "overdue",
    ).length;
  });
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Open invoices" value={q.data ?? 0} icon={CreditCard} />;
}

export function StatPendingReviewsWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("qa-queue", agencyId, async () => {
    const data = await backendGet<{ sessions?: unknown[] }>(
      `/api/agencies/${encodeURIComponent(agencyId)}/qa/queue?status=pending&limit=100`,
    );
    return data?.sessions?.length ?? 0;
  });
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Pending reviews" value={q.data ?? 0} icon={BarChart3} />;
}

export function StatIntegrationErrorsWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("integration-health", agencyId, async () => {
    const data = await backendGet<{ integrations?: Array<{ status: string }> }>(
      `/api/agencies/${encodeURIComponent(agencyId)}/integrations/health`,
    );
    return data?.integrations?.filter((i) => i.status === "error" || i.status === "offline").length ?? 0;
  });
  if (q.isLoading) return <WidgetSkeleton />;
  return (
    <StatCard
      label="Integration errors"
      value={q.data ?? 0}
      icon={Wifi}
      valueColor={(q.data ?? 0) > 0 ? "text-rose-400" : "text-white"}
    />
  );
}

export function StatBedsAvailableWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("facility-capacity", agencyId, async () => {
    const data = await backendGet<{ bedsAvailable?: number }>(
      `/api/hospital/${encodeURIComponent(agencyId)}/capacity/current`,
    );
    return data?.bedsAvailable ?? "—";
  });
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Beds available" value={q.data ?? "—"} icon={Bed} />;
}

export function StatStaffOnDutyWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("venue-staff", agencyId, async () => {
    const data = await backendGet<{ staffOnDuty?: number }>(
      `/api/venue/${encodeURIComponent(agencyId)}/stats/live`,
    );
    return data?.staffOnDuty ?? 0;
  }, 30_000);
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Staff on duty" value={q.data ?? 0} icon={Users} />;
}

export function StatCamerasOnlineWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("venue-cameras", agencyId, async () => {
    const data = await backendGet<{ camerasOnline?: number }>(
      `/api/venue/${encodeURIComponent(agencyId)}/stats/live`,
    );
    return data?.camerasOnline ?? 0;
  }, 30_000);
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Cameras online" value={q.data ?? 0} icon={Camera} />;
}

export function StatOpenGuestReportsWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("guest-reports", agencyId, async () => {
    const data = await backendGet<{ reports?: unknown[] }>(
      `/api/venue/${encodeURIComponent(agencyId)}/guest-reports?status=open&limit=100`,
    );
    return data?.reports?.length ?? 0;
  }, 30_000);
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="Guest reports" value={q.data ?? 0} icon={MessageSquare} />;
}

export function StatQrScansTodayWidget({ agencyId }: WidgetProps) {
  const q = useStatQuery("qr-activity", agencyId, async () => {
    const locations = await fetchLocations(agencyId, { active: true }).catch(() => []);
    const today = new Date().toDateString();
    return locations.reduce((sum, loc) => {
      const scannedToday = loc.lastScannedAt
        ? new Date(loc.lastScannedAt).toDateString() === today
        : false;
      return sum + (scannedToday ? Math.max(loc.scanCount ?? 0, 1) : 0);
    }, 0);
  }, 60_000);
  if (q.isLoading) return <WidgetSkeleton />;
  return <StatCard label="QR scans today" value={q.data ?? 0} icon={QrCode} />;
}
