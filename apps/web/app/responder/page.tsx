import { redirect } from "next/navigation";
import { isIqResponderEnabled } from "@/lib/runtime-flags";

export default function ResponderHomePage() {
  if (!isIqResponderEnabled()) {
    redirect("/not-authorized");
  }
  return (
    <main className="min-h-screen bg-[#0f1117] px-6 py-10 text-slate-100">
      <h1 className="text-2xl font-semibold tracking-tight">iQ Responder</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-400">
        Open an assigned incident from dispatch or navigate to{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-300">
          /responder/incident/&lt;incidentId&gt;
        </code>
        .
      </p>
    </main>
  );
}
