"use client";

import Link from "next/link";
import { MarketingBookAppointmentLink } from "@/components/marketing/marketing-book-appointment-link";
import { marketingDemoRequestPath } from "@/lib/marketing-links";

export function MarketingPilotResourcesStrip() {
  const demo = marketingDemoRequestPath("demo");

  return (
    <section className="border-y border-slate-800/80 bg-slate-950/80 px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Agency Pilot &amp; Evaluation
        </h2>
        <p className="mt-5 text-base leading-relaxed text-slate-400 md:text-lg">
          Evaluate NexCort iQ in a guided pilot built for public safety teams. Each pilot includes a
          defined technical scope, onboarding support, success criteria, and clear operational
          boundaries — so your agency can assess real impact before committing.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={demo}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500"
          >
            Request a Demo
          </Link>
          <MarketingBookAppointmentLink className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-500 bg-transparent px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400 hover:bg-slate-900/60">
            Book an Appointment
          </MarketingBookAppointmentLink>
        </div>
      </div>
    </section>
  );
}
