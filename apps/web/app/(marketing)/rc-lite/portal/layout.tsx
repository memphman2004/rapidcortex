import Link from "next/link";

const NAV = [
  { href: "/rc-lite/portal", label: "Overview" },
  { href: "/rc-lite/portal/api-clients", label: "API clients" },
  { href: "/rc-lite/portal/usage", label: "Usage" },
  { href: "/rc-lite/portal/webhooks", label: "Webhooks" },
  { href: "/rc-lite/portal/docs", label: "Docs" },
  { href: "/rc-lite/portal/billing", label: "Billing" },
  { href: "/rc-lite/portal/audit-logs", label: "Audit logs" },
] as const;

export default function RcLitePortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-slate-100 sm:px-6 lg:grid lg:grid-cols-[220px,minmax(0,1fr)] lg:gap-10">
      <aside className="mb-8 lg:mb-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-400/90">RC Lite console</p>
        <p className="mt-1 text-sm text-slate-400">API credentials, usage, and webhooks only.</p>
        <nav className="mt-6 flex flex-col gap-1 text-sm" aria-label="RC Lite portal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-900/80 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
