import { notFound } from "next/navigation";
import { RoiCalculatorPublic } from "@/components/sales/roi-calculator-public";
import type { RoiInputs } from "rapid-cortex-shared";
import { getRoiSession } from "@/lib/sales/sales-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function PublicRoiPage({ params }: Props) {
  const { token } = await params;
  const session = await getRoiSession(token);
  if (!session) notFound();
  const ttl = Number(session.ttl ?? 0);
  if (ttl && ttl < Math.floor(Date.now() / 1000)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] text-slate-300">
        Link expired
      </div>
    );
  }
  const inputs = session.inputs as RoiInputs;
  return (
    <div className="min-h-screen bg-[#030712]">
      <RoiCalculatorPublic initial={inputs} />
    </div>
  );
}
