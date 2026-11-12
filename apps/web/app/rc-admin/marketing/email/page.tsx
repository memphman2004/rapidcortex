import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Email & Newsletters",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TOOLS = [
  {
    label: "Email List",
    description: "Manage your subscriber database. Import from Apollo, segment by vertical, and sync recipients to SES campaigns.",
    href: "/rc-admin/email-list",
    cta: "Open Email List",
    color: "sky",
  },
  {
    label: "Email Campaigns",
    description: "Create, approve, and send SES email campaigns to segmented lists with open and click tracking.",
    href: "/rc-admin/sales-automation",
    cta: "Open Campaigns",
    color: "sky",
  },
  {
    label: "NexCortiQ Signal",
    description: "The NexCortiQ Signal newsletter — browse and approve editions, send to subscribers, and track engagement.",
    href: "/rc-admin/signal-feed",
    cta: "Open Signal Feed",
    color: "violet",
  },
] as const;

export default async function EmailNewslettersPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/email`);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-3 py-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Email & Newsletters</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage subscribers, campaigns, and newsletter editions.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {TOOLS.map((tool) => (
          <div
            key={tool.label}
            className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5"
          >
            <h2 className="mb-2 text-base font-semibold text-white">{tool.label}</h2>
            <p className="mb-4 text-sm text-slate-400">{tool.description}</p>
            <Link
              href={tool.href}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tool.color === "violet"
                  ? "bg-violet-700/20 text-violet-400 hover:bg-violet-700/40"
                  : "bg-sky-700/20 text-sky-400 hover:bg-sky-700/40"
              }`}
            >
              {tool.cta} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
