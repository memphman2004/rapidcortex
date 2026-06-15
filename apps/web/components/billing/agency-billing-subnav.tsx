import Link from "next/link";

type Props = {
  agencyId: string;
  active: "billing" | "feature-add-ons" | "network";
};

export function AgencyBillingSubnav({ agencyId, active }: Props) {
  const base = `/rc-admin/agencies/${encodeURIComponent(agencyId)}`;
  const linkClass = (key: Props["active"]) =>
    key === active
      ? "border-b-2 border-violet-500 pb-2 text-sm font-medium text-violet-300"
      : "text-sm text-sky-400 hover:text-sky-300";

  return (
    <nav className="flex flex-wrap gap-5 border-b border-white/10 pb-3">
      <Link href={`${base}/billing`} className={linkClass("billing")}>
        Billing hub
      </Link>
      <Link href={`${base}/billing/feature-add-ons`} className={linkClass("feature-add-ons")}>
        Feature add-ons →
      </Link>
      <Link href={`${base}/network`} className={linkClass("network")}>
        Network access →
      </Link>
    </nav>
  );
}
