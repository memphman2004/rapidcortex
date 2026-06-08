import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = {
  title: "Security",
  robots: { index: false, follow: false },
};

function SecurityCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-700/60 bg-slate-900/60 p-5 transition-colors hover:border-cyan-700/40 hover:bg-slate-900"
    >
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </Link>
  );
}

export default async function RcAdminSecurityPage() {
  await requireRole(["rcitadmin", "rcsuperadmin"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Security</h1>
        <p className="mt-1 text-sm text-slate-400">
          MFA policy, authentication posture, and platform perimeter controls for RC Internal IT.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SecurityCard
          title="Failed auth & health signals"
          description="CloudWatch, Lambda errors, and Cognito auth failure trends."
          href="/rc-admin/system-health"
        />
        <SecurityCard
          title="Cross-tenant user support"
          description="Reset passwords, unlock accounts, and re-enroll MFA for compromised users."
          href="/rc-admin/users"
        />
        <SecurityCard
          title="Audit log"
          description="Cross-tenant security and configuration events (view only — no export)."
          href="/rc-admin/audit"
        />
        <SecurityCard
          title="Agency network access"
          description="Per-tenant IP and shift enforcement policies during onboarding."
          href="/rc-admin/agencies"
        />
      </div>
    </div>
  );
}
