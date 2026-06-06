export const metadata = { title: "RC Lite — audit logs", robots: { index: false, follow: false } };

export default function RcLitePortalAuditLogsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Audit logs</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        API authentication events, credential rotations, webhook mutations, and export operations will surface here for
        agency security teams.
      </p>
    </div>
  );
}
