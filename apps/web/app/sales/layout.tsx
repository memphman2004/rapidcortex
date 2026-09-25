export const dynamic = "force-dynamic";

/** Lightweight shell — sales portal has its own tab chrome (matches RC Admin dark theme). */
export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#030712] text-slate-100">
      <header className="border-b border-white/5 bg-[#0a1628]/80 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <a href="/sales" className="text-sm font-semibold tracking-tight text-white">
            NexCort iQ <span className="font-normal text-sky-400">Sales</span>
          </a>
          <a
            href="/logout"
            className="text-xs text-slate-500 transition hover:text-slate-300"
          >
            Sign out
          </a>
        </div>
      </header>
      {children}
    </div>
  );
}
