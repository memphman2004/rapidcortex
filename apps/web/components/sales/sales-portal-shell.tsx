"use client";

import { useMemo, useState } from "react";
import { LeadsCrmPage } from "@/components/rc-admin/leads/leads-crm-page";
import { SalesAutomationClient } from "@/components/rapid-iq/sales-automation-client";
import { QuoteBuilder } from "@/components/sales/quote-builder";
import { SalesNewsPanel } from "@/components/sales/sales-news-panel";
import { TerritoryRosterPanel } from "@/components/sales/territory-roster-panel";
import { SalesLibrary } from "@/components/sales/sales-library";
import { SalesCommissionPanel } from "@/components/sales/sales-commission-panel";
import { KpiDashboard } from "@/components/sales/kpi-dashboard";
import { RoiGenerator } from "@/components/sales/roi-generator";
import { PreCallPlanner } from "@/components/sales/pre-call-planner";
import { OutreachTemplatesPanel } from "@/components/sales/outreach-templates-panel";
import { RfpTracker } from "@/components/sales/rfp-tracker";
import { ActivityLog } from "@/components/sales/activity-log";
import { AccountClaims } from "@/components/sales/account-claims";
import { ColdLeadAlerts } from "@/components/sales/cold-lead-alerts";

export type SalesPortalTab =
  | "pipeline"
  | "campaigns"
  | "quote"
  | "news"
  | "regions"
  | "library"
  | "earnings"
  | "kpi"
  | "roi"
  | "pre-call"
  | "templates"
  | "rfp"
  | "activity"
  | "accounts";

type TabDef = { id: SalesPortalTab; label: string; group: string };

const TABS: TabDef[] = [
  { id: "pipeline", label: "Pipeline", group: "CRM" },
  { id: "campaigns", label: "Campaigns", group: "CRM" },
  { id: "kpi", label: "KPI", group: "CRM" },
  { id: "earnings", label: "Earnings", group: "CRM" },
  { id: "quote", label: "Quote", group: "Tools" },
  { id: "roi", label: "ROI Calc", group: "Tools" },
  { id: "pre-call", label: "Pre-Call", group: "Tools" },
  { id: "templates", label: "Templates", group: "Tools" },
  { id: "news", label: "News", group: "Intel" },
  { id: "regions", label: "Team Regions", group: "Intel" },
  { id: "rfp", label: "RFP Tracker", group: "Intel" },
  { id: "library", label: "Library", group: "Enablement" },
  { id: "activity", label: "Activity", group: "Enablement" },
  { id: "accounts", label: "Accounts", group: "Enablement" },
];

type Props = {
  contractorEmail?: string;
  contractorName?: string;
  assigneeFilter?: string;
};

export function SalesPortalShell({
  contractorEmail,
  contractorName,
  assigneeFilter,
}: Props) {
  const [tab, setTab] = useState<SalesPortalTab>("pipeline");

  const groups = useMemo(() => {
    const map = new Map<string, TabDef[]>();
    for (const t of TABS) {
      const list = map.get(t.group) ?? [];
      list.push(t);
      map.set(t.group, list);
    }
    return [...map.entries()];
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#050c1a]">
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-4">
        <h1 className="text-xl font-semibold text-white">Sales Portal</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Pipeline, campaigns, quotes with free offerings, news intel, and territory coverage —
          built for NexCort iQ contractors.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-2.5">
        {groups.map(([group, items]) => (
          <div key={group} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {group}
            </span>
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                  tab === t.id
                    ? "border-sky-500 bg-sky-500/10 text-sky-300"
                    : "border-[rgba(255,255,255,0.06)] text-slate-500 hover:border-[rgba(255,255,255,0.12)] hover:text-slate-300",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-5">
        {tab === "pipeline" && (
          <div className="space-y-4">
            <ColdLeadAlerts assigneeFilter={assigneeFilter} />
            <LeadsCrmPage />
          </div>
        )}
        {tab === "campaigns" && <SalesAutomationClient />}
        {tab === "quote" && (
          <QuoteBuilder
            proposedBy={contractorName ?? contractorEmail ?? "Sales"}
            defaultLeadAssignee={assigneeFilter}
          />
        )}
        {tab === "news" && <SalesNewsPanel />}
        {tab === "regions" && <TerritoryRosterPanel />}
        {tab === "library" && <SalesLibrary />}
        {tab === "earnings" && <SalesCommissionPanel assigneeFilter={assigneeFilter} />}
        {tab === "kpi" && <KpiDashboard assigneeFilter={assigneeFilter} />}
        {tab === "roi" && <RoiGenerator />}
        {tab === "pre-call" && <PreCallPlanner />}
        {tab === "templates" && <OutreachTemplatesPanel />}
        {tab === "rfp" && <RfpTracker defaultAssignee={contractorEmail} />}
        {tab === "activity" && (
          <ActivityLog
            contractorEmail={contractorEmail}
            contractorName={contractorName}
          />
        )}
        {tab === "accounts" && <AccountClaims />}
      </div>
    </div>
  );
}
