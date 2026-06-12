import Link from "next/link";
import { SiteLogoMark } from "@/components/brand/site-logo-link";

export const dynamic = "force-dynamic";

export default function NotAuthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4" style={{ borderTop: "4px solid #64748b" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <SiteLogoMark className="h-8 w-auto" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">Access not available</h1>
        <p className="mt-6 text-slate-300">
          Your account role does not have access to this page. Contact your administrator or Rapid Cortex
          support.
        </p>
        <p className="mt-8">
          <Link
            href="/api/auth/signout"
            className="text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline"
          >
            Sign out
          </Link>
        </p>
      </main>
    </div>
  );
}
