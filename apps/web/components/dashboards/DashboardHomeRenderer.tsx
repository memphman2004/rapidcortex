"use client";

/**
 * apps/web/components/dashboards/DashboardHomeRenderer.tsx
 *
 * Renders the correct dashboard home for any role using the layout config
 * and widget registry. Drop this into each role's home page component.
 *
 * Usage:
 *   <DashboardHomeRenderer role={session.role} agencyId={session.agencyId} />
 *
 * The dispatcher role is handled separately (live workspace takes over).
 * For all other roles this renders a responsive 12-column grid of widgets.
 */

import { Suspense } from "react";
import {
  getWidgetLayout,
  SPAN_CLASS,
  HEIGHT_CLASS,
  type WidgetSlot,
  type RoleWidgetLayout,
} from "@/lib/dashboards/widget-layout-config";
import { WIDGET_REGISTRY } from "@/components/widgets";
import { isNavFeatureEnabled } from "@/lib/navigation/nav-feature-gates";

// ─── Widget slot renderer ─────────────────────────────────────────────────────

function WidgetSlotRenderer({
  slot,
  agencyId,
  accent,
}: {
  slot: WidgetSlot;
  agencyId: string;
  accent: string;
}) {
  if (slot.feature && !isNavFeatureEnabled(slot.feature)) return null;

  const Component = WIDGET_REGISTRY[slot.id];
  const spanClass   = SPAN_CLASS[slot.span];
  const heightClass = HEIGHT_CLASS[slot.height];

  return (
    <div className={`${spanClass} ${heightClass}`}>
      <Suspense fallback={
        <div className={`h-full rounded-xl border border-slate-800 bg-slate-900 ${heightClass}`}>
          <div className="h-full animate-pulse rounded-xl bg-slate-800/50" />
        </div>
      }>
        <Component agencyId={agencyId} accent={accent} />
      </Suspense>
    </div>
  );
}

// ─── Dashboard header ─────────────────────────────────────────────────────────

function DashboardHeader({
  layout,
  displayName,
}: {
  layout: RoleWidgetLayout;
  displayName: string;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    "Good evening";

  return (
    <div className="mb-6">
      <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
        {layout.greeting}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-white">
        {greeting}, {displayName.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-400">{layout.description}</p>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

type Props = {
  role: string;
  agencyId: string;
  displayName?: string;
};

export function DashboardHomeRenderer({ role, agencyId, displayName = "there" }: Props) {
  const layout = getWidgetLayout(role);

  if (!layout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-sm text-slate-500">No dashboard configured for role: {role}</p>
          <a href="/auth/signout" className="mt-4 block text-xs text-slate-600 underline">
            Sign out
          </a>
        </div>
      </div>
    );
  }

  // Sort widgets by priority for skeleton shimmer sequencing
  const sortedWidgets = [...layout.widgets].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      <DashboardHeader layout={layout} displayName={displayName} />

      {/* 12-column responsive grid */}
      <div className="grid grid-cols-12 gap-4">
        {sortedWidgets.map(slot => (
          <WidgetSlotRenderer
            key={slot.id}
            slot={slot}
            agencyId={agencyId}
            accent={layout.accent}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Per-vertical wrappers (convenience) ─────────────────────────────────────
// These are thin wrappers used by the actual page components so they
// don't need to import both the renderer and the session logic.

export function PsapDashboardHome({ role, agencyId, displayName }: Props) {
  // Dispatcher gets the live workspace, not the grid renderer
  if (role === "dispatcher") {
    // Return null — DispatcherWorkspace handles the dispatcher home
    return null;
  }
  return <DashboardHomeRenderer role={role} agencyId={agencyId} displayName={displayName} />;
}

export function VenueDashboardHome({ venueCode, role, agencyId, displayName }: Props & { venueCode: string }) {
  return <DashboardHomeRenderer role={role} agencyId={agencyId} displayName={displayName} />;
}

export function CampusDashboardHome({ campusCode, role, agencyId, displayName }: Props & { campusCode: string }) {
  return <DashboardHomeRenderer role={role} agencyId={agencyId} displayName={displayName} />;
}

export function HospitalDashboardHome({ role, agencyId, displayName }: Props) {
  return <DashboardHomeRenderer role={role} agencyId={agencyId} displayName={displayName} />;
}

export function RcAdminDashboardHome({ role, agencyId, displayName }: Props) {
  return <DashboardHomeRenderer role={role} agencyId={agencyId} displayName={displayName} />;
}
