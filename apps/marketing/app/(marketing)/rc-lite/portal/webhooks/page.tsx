export const metadata = { title: "RC Lite — webhooks", robots: { index: false, follow: false } };

export default function RcLitePortalWebhooksPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Webhooks</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        Configure signing secrets and delivery endpoints for exporter readiness, transcripts, AI summaries, and integration
        health signals.
      </p>
    </div>
  );
}
