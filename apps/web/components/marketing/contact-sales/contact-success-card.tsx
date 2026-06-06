"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, PlayCircle, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { marketingHomePath, marketingPricingPath } from "@/lib/marketing-links";

const RC_LOGO = "/rapid-cortex-logo-2.png";
const YOUTUBE_PLAYLIST =
  "https://www.youtube.com/playlist?list=PLQF5lJISQEZVr1E0XCdWHB3EI8Ug7KLLb";

export type ContactSuccessCardProps = {
  /** Optional CRM / backend reference when API returns `leadId`. */
  referenceId?: string | null;
  submittedAt: Date;
};

/**
 * Optional success chime — disabled until an asset + explicit env flag exist.
 * (`NEXT_PUBLIC_CONTACT_SUCCESS_SOUND=1` — placeholder; no audio shipped yet.)
 */
function maybePlaySuccessSound() {
  if (process.env.NEXT_PUBLIC_CONTACT_SUCCESS_SOUND !== "1") return;
  /* Future: new Audio('/sounds/contact-success.mp3').play().catch(() => {}) */
}

export function ContactSuccessCard({ referenceId, submittedAt }: ContactSuccessCardProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    maybePlaySuccessSound();
  }, []);

  const tsLabel = submittedAt.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 28 };

  return (
    <motion.div
      role="region"
      aria-labelledby="contact-sales-page-title"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0.001 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto max-w-4xl"
    >
      {/* Subtle grid + gradient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-b from-sky-950/40 via-slate-950/80 to-slate-950" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(56, 189, 248, 0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(56, 189, 248, 0.06) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute -left-1/4 top-0 h-[420px] w-[140%] rounded-full bg-sky-500/10 blur-[100px]" />
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-6 shadow-[0_0_80px_-20px_rgba(56,189,248,0.35)] backdrop-blur-md sm:p-10 md:p-12">
        {/* Logo + glow */}
        <motion.div
          className="relative mx-auto mb-8 flex justify-center"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring}
        >
          <div
            className="absolute inset-0 flex justify-center blur-2xl"
            aria-hidden
          >
            <div className="h-24 w-48 rounded-full bg-sky-400/25" />
          </div>
          <div className="relative rounded-2xl border border-sky-500/20 bg-slate-900/50 p-4 shadow-inner shadow-sky-950/50 ring-1 ring-sky-400/15">
            <Image
              src={RC_LOGO}
              alt="Rapid Cortex"
              width={220}
              height={56}
              className="h-auto w-[min(220px,70vw)] object-contain"
              priority
            />
          </div>
        </motion.div>

        {/* Icon row */}
        <motion.div
          className="mb-6 flex justify-center gap-4"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: reduceMotion ? 0 : 0.08 }}
        >
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-2 ring-emerald-400/40"
            initial={reduceMotion ? false : { scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={spring}
            aria-hidden
          >
            <CheckCircle2 className="h-9 w-9 text-emerald-400" strokeWidth={1.75} />
          </motion.div>
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 ring-2 ring-sky-400/35"
            initial={reduceMotion ? false : { scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ ...spring, delay: reduceMotion ? 0 : 0.06 }}
            aria-hidden
          >
            <ShieldCheck className="h-9 w-9 text-sky-400" strokeWidth={1.75} />
          </motion.div>
        </motion.div>

        <p
          aria-hidden
          className="text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl"
        >
          Request received
        </p>
        <p className="mt-3 text-center text-lg text-sky-100/90">Thank you for contacting Rapid Cortex.</p>

        <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-slate-300">
          Our team will review your request and contact you soon to schedule a discovery call and discuss your
          operational, integration, or deployment needs.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-400">
          Rapid Cortex works alongside existing CAD, telephony, and emergency response workflows to help agencies
          improve situational awareness and operational intelligence.
        </p>

        <p className="mt-6 text-center text-xs text-slate-500">
          Request submitted successfully · <time dateTime={submittedAt.toISOString()}>{tsLabel}</time>
        </p>
        {referenceId ? (
          <p className="mt-2 text-center font-mono text-[11px] text-slate-500">
            Reference ID: <span className="text-slate-400">{referenceId}</span>
          </p>
        ) : (
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Save this page or check your email — a reference code may be included in follow-up messages from our team.
          </p>
        )}
        <p className="mt-4 text-center text-[11px] text-slate-600">
          Business inquiries are typically reviewed during standard operating hours.
        </p>

        {/* Discovery call panel */}
        <div className="mt-10 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-950/50 to-slate-900/60 p-6 ring-1 ring-sky-400/10">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
            Next Step: Discovery Call
          </h3>
          <p className="mt-3 text-sm text-slate-300">
            A Rapid Cortex specialist will discuss:
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-400 marker:text-sky-500">
            <li>Current CAD/RMS environment</li>
            <li>Operational goals</li>
            <li>Integration requirements</li>
            <li>Pilot program eligibility</li>
            <li>Deployment and support options</li>
          </ul>
        </div>

        {/* CTAs */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={marketingHomePath()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-sky-950/40 transition hover:from-sky-500 hover:to-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Return to homepage
          </Link>
          <Link
            href={marketingPricingPath()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-600 bg-slate-900/60 px-6 py-3 text-center text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:border-sky-500/40 hover:bg-slate-800/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Schedule availability later
          </Link>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-600">
          Explore pricing and pilot paths while you wait — no obligation.
        </p>

        {/* Videos section */}
        <div className="mt-14 border-t border-slate-800/80 pt-10">
          <h3 className="text-center text-lg font-semibold text-white">Want to learn more while you wait?</h3>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-slate-400">
            You can view Rapid Cortex intelligence videos that explain platform capabilities, operational workflows, CAD
            integration concepts, and emergency response intelligence.
          </p>
          <div className="mt-6 flex justify-center">
            <a
              href={YOUTUBE_PLAYLIST}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex min-h-[48px] items-center gap-3 rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/40 to-slate-900/80 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_40px_-12px_rgba(239,68,68,0.45)] transition hover:border-red-400/50 hover:shadow-[0_0_48px_-8px_rgba(239,68,68,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
            >
              <PlayCircle
                className="h-6 w-6 shrink-0 text-red-400 transition group-hover:scale-105"
                aria-hidden
              />
              <span>Rapid Cortex Videos</span>
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">
            View demos, walkthroughs, operational concepts, and platform overviews.
          </p>
        </div>

      </div>
    </motion.div>
  );
}
