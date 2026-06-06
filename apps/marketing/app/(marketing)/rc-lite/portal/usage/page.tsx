export const metadata = { title: "RC Lite — usage", robots: { index: false, follow: false } };

export default function RcLitePortalUsagePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Usage</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        Usage meters will summarize API requests, summaries, transcription/translation throughput, webhook deliveries, and
        exporter runs per billing cycle.
      </p>
    </div>
  );
}
