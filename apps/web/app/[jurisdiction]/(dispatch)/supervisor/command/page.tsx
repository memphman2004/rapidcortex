"use client";

import Link from "next/link";
import { Clock, FileSearch, Globe, Radio } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

const commandCards = [
  {
    title: "War Rooms",
    description: "Coordinate tasks and checklists during major incidents",
    href: "/supervisor/command/war-rooms",
    badge: "0 Active",
    icon: Radio,
  },
  {
    title: "Post-Incident Reviews",
    description: "Structure lessons-learned after significant events",
    href: "/supervisor/command/pir",
    badge: "0 Pending",
    icon: FileSearch,
  },
  {
    title: "Stakeholder Status Pages",
    description: "Publish controlled status updates to leadership",
    href: "/supervisor/command/status-pages",
    badge: "0 Published",
    icon: Globe,
  },
  {
    title: "Incident Timeline",
    description: "Reconstruct event sequences for AAR and training",
    href: "/supervisor/command/timeline",
    badge: "View All",
    icon: Clock,
  },
] as const;

export default function SupervisorCommandPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Command</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Manage major incidents, war rooms, and post-incident reviews.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {commandCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={to(card.href)}
              className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 transition-colors hover:bg-slate-900/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-sky-300" />
                  <h2 className="text-sm font-semibold text-slate-100">{card.title}</h2>
                </div>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{card.badge}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
