export default function ReportInactivePage() {
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-4xl" aria-hidden>
        🔒
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-slate-800">This reporting link is no longer active.</h1>
      <p className="mt-3 max-w-sm text-sm text-slate-500">
        Please contact security directly or call 911 for emergencies.
      </p>
    </section>
  );
}
