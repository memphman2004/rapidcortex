import Link from "next/link";
import {
  marketingContactSalesPath,
  marketingHomePath,
  marketingPricingPath,
} from "@/lib/marketing-links";

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

function messageFor(reason: string | undefined) {
  if (reason === "dashboard_subscription_required") {
    return "Your account does not currently include Rapid Cortex dashboard access. Contact your agency administrator or Rapid Cortex support.";
  }
  return "Your account is active, but no product access has been assigned yet. Ask your Rapid Cortex billing contact to attach a Rapid Cortex dashboard plan or an RC Lite subscription.";
}

export default async function NoProductAccessPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const summary = messageFor(reason);

  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center text-slate-200">
      <h1 className="text-xl font-semibold text-white">Limited access</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-400">{summary}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
        <Link className="text-sky-400 hover:text-sky-300 hover:underline" href={marketingHomePath()}>
          Home
        </Link>
        <Link className="text-sky-400 hover:text-sky-300 hover:underline" href={marketingPricingPath()}>
          Plans
        </Link>
        <Link className="text-sky-400 hover:text-sky-300 hover:underline" href={marketingContactSalesPath()}>
          Contact Support
        </Link>
      </div>
    </div>
  );
}
