import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Online report",
  robots: { index: false, follow: false },
  description: "Non-emergency self-service reporting link from Call Assist.",
};

export default function CallAssistPublicReportLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0f1117] text-slate-100">{children}</div>;
}
