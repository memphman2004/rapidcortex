import type { ReactNode } from "react";

export default function CampusShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}
