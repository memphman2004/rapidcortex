/** Procurement-oriented billing notice — Rapid Cortex does not offer public card checkout here. */

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function BillingSelfServeNotice(props: {
  headline: string;
  subheadline: string;
  planName: string;
  billingFrequency: string;
  includedFeatures: string[];
  amountCents: number;
  agencyIdPrefill?: string;
  productLine: "rapid_cortex" | "rc_lite";
}) {
  const line =
    props.productLine === "rc_lite"
      ? "RC Lite API access"
      : "Rapid Cortex platform (dashboard seats)";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-black/20 sm:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{props.headline}</h1>
        <p className="mt-2 text-sm text-slate-400">{props.subheadline}</p>
      </div>
      <dl className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-sm text-slate-300">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Plan</dt>
          <dd className="text-right font-medium text-slate-100">{props.planName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Cadence</dt>
          <dd className="capitalize">{props.billingFrequency}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Reference list</dt>
          <dd className="text-right">{formatUsd(props.amountCents)} / month (indicative)</dd>
        </div>
        {props.agencyIdPrefill ? (
          <div className="flex justify-between gap-4 border-t border-slate-800/80 pt-2">
            <dt className="text-slate-500">Agency</dt>
            <dd className="max-w-[14rem] truncate font-mono text-xs text-slate-400">{props.agencyIdPrefill}</dd>
          </div>
        ) : null}
      </dl>
      <ul className="list-inside list-disc space-y-1 text-sm text-slate-400">
        {props.includedFeatures.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-100/90">
        <p>
          Rapid Cortex is sold through agency contracts, approved pilots, purchase orders, invoices, and authorized
          procurement workflows. Complete access for{" "}
          <strong className="text-amber-50">{line}</strong>{" "}
          through your contracting office or Rapid Cortex sales — not via public card checkout on this site.
        </p>
      </div>
    </div>
  );
}
