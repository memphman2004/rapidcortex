export const metadata = { title: "RC Lite — API clients", robots: { index: false, follow: false } };

export default function RcLitePortalApiClientsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">API clients</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        Provision, rotate, and retire OAuth-capable RC Lite credentials. Detailed automation ships with forthcoming billing UI;
        until then Rapid Cortex onboarding teams fulfill rotations through audited workflows.
      </p>
    </div>
  );
}
