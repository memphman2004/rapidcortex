export default function CardUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070612] px-6 text-center text-white">
      <div className="max-w-md">
        <p className="text-sm font-semibold tracking-wide text-violet-300">NexCort iQ</p>
        <h1 className="mt-3 text-3xl font-semibold">This card is unavailable</h1>
        <p className="mt-3 text-sm text-slate-400">The profile is unpublished, or this link does not match a card.</p>
      </div>
    </main>
  );
}
