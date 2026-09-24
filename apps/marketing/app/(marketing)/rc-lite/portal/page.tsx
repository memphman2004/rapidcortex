import Link from "next/link";

export const metadata = {
  title: "NexCort Lite portal",
  robots: { index: false, follow: false },
};

export default function RcLitePortalHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">NexCort Lite portal</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
        Manage OAuth clients, usage, webhooks, and documentation from this console. This area never exposes NexCort iQ
        dispatcher, supervisor, QA, or executive dashboards—those require a NexCort iQ platform subscription.
      </p>
      <p className="mt-6 text-sm text-slate-500">
        Detailed controls are rolling out alongside billing automation. Need help?{" "}
        <Link className="text-sky-400 hover:text-sky-300" href="/contact-sales?interest=api_access">
          Contact the integration team
        </Link>
        .
      </p>
    </div>
  );
}
