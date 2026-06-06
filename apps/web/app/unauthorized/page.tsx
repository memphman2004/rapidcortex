import Link from "next/link";
import { marketingContactPath, marketingHomePath, marketingLoginPath } from "@/lib/marketing-links";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function UnauthorizedPage({ searchParams }: Props) {
  const raw = searchParams !== undefined ? await searchParams : undefined;
  const reason = typeof raw?.reason === "string" ? raw.reason : "";
  let detail =
    "Your account signed in correctly, but this browser could not load your Rapid Cortex workspace session. Try signing in again, use a supported desktop browser, or contact your administrator.";
  if (reason === "inactive") {
    detail =
      "This account is not active for Rapid Cortex. Contact your agency administrator if you believe this is a mistake.";
  } else if (reason === "claims") {
    detail =
      "Your sign-in succeeded, but required account fields (agency or permissions) could not be read. Ask your administrator to verify your Rapid Cortex assignment.";
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 py-16 text-center text-slate-100">
      <h1 className="text-xl font-semibold tracking-tight">Access could not be completed</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">{detail}</p>
      <ul className="mt-8 flex flex-col gap-3 text-sm text-sky-400">
        <li>
          <Link href={marketingLoginPath()} className="underline hover:text-sky-300">
            Return to sign in
          </Link>
        </li>
        <li>
          <Link href={marketingHomePath()} className="underline hover:text-sky-300">
            Home
          </Link>
        </li>
        <li>
          <Link href={marketingContactPath()} className="underline hover:text-sky-300">
            Contact Rapid Cortex
          </Link>
        </li>
      </ul>
    </div>
  );
}
