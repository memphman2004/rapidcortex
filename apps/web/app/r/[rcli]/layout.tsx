import type { ReactNode } from "react";

export default function QRIntakeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">{children}</main>
      <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 py-3 text-center text-xs text-slate-500 backdrop-blur">
        For life-threatening emergencies, call 911.
      </footer>
    </div>
  );
}
