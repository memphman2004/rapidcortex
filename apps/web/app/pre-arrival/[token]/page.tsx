import type { Metadata } from "next";
import { PreArrivalCallerClient } from "@/components/pre-arrival/pre-arrival-caller-client";
import { isPreArrivalIqEnabled } from "@/lib/runtime-flags";

export const metadata: Metadata = {
  title: "Pre-Arrival iQ — NexCort iQ",
  robots: { index: false, follow: false },
};

export default async function PreArrivalTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isPreArrivalIqEnabled()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 text-slate-200">
        <p className="text-sm text-slate-400">This link is not available.</p>
      </main>
    );
  }
  return <PreArrivalCallerClient token={token} />;
}
