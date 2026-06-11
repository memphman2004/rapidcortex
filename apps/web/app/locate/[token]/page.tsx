import { isSmsLocationEnabled } from "@/lib/runtime-flags";
import { LocateCallerClient } from "@/components/locate/locate-caller-client";

export default async function LocatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isSmsLocationEnabled()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071510] px-6 text-center text-white">
        <p className="text-lg text-slate-400">Location sharing is not available.</p>
      </main>
    );
  }
  return <LocateCallerClient token={token} />;
}
