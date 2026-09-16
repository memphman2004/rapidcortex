export const dynamic = "force-dynamic";

export default function CallAssistSelfServiceReportMissingTokenPage() {
  return (
    <main className="mx-auto max-w-lg space-y-4 p-6 text-slate-100">
      <h1 className="text-lg font-semibold">Online report</h1>
      <p className="text-sm text-slate-400">
        This is not for emergencies. If someone is hurt or in danger, hang up and dial 911.
      </p>
      <p className="text-sm text-slate-300">
        This page needs the full secure link from your text message. Open the message and tap the complete link — do not
        type the address by hand.
      </p>
    </main>
  );
}
