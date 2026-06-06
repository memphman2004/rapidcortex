"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ContactSalesForm } from "@/components/marketing/contact-sales/contact-sales-form";
import { ContactSuccessCard } from "@/components/marketing/contact-sales/contact-success-card";
import { marketingHomePath, marketingPricingPath } from "@/lib/marketing-links";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

export type ContactSalesPageBodyProps = {
  interestFromSearch?: string | null;
};

/**
 * Full contact-sales page chrome (mirrors `MarketingArticleShell`) with conditional hero + success flow.
 */
export function ContactSalesPageBody({ interestFromSearch = null }: ContactSalesPageBodyProps) {
  const [completion, setCompletion] = useState<{ submittedAt: Date; referenceId: string | null } | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const pageTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!completion) return;
    const previousTitle = document.title;
    document.title = "Request received | Rapid Cortex";
    const t = window.setTimeout(() => pageTitleRef.current?.focus(), reduceMotion ? 0 : 100);
    return () => {
      window.clearTimeout(t);
      document.title = previousTitle;
    };
  }, [completion, reduceMotion]);

  const home = marketingHomePath();
  const pricing = marketingPricingPath();

  return (
    <article
      className={`mx-auto px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16 ${completion ? "max-w-4xl" : "max-w-3xl"}`}
    >
      <p className="text-xs text-slate-500">
        <Link href={home} className="text-sky-400/90 hover:text-sky-300">
          Home
        </Link>
        <span className="mx-2 text-slate-600">/</span>
        <span className="text-slate-400">Sales</span>
      </p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">Procurement</p>
      <h1
        ref={pageTitleRef}
        id="contact-sales-page-title"
        tabIndex={completion ? -1 : undefined}
        className={
          completion
            ? "sr-only outline-none"
            : "mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl"
        }
      >
        {completion ? "Request received" : "Contact Support to Enter the Cortex"}
      </h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-300 [&_a]:text-sky-400 [&_a]:underline-offset-2 hover:[&_a]:text-sky-300 [&_ul]:list-inside [&_ul]:list-disc [&_ul]:space-y-2 [&_strong]:font-medium [&_strong]:text-slate-200">
        <AnimatePresence mode="wait">
          {!completion ? (
            <motion.div
              key="flow-form"
              initial={false}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      filter: "blur(6px)",
                      transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
                    }
              }
            >
              <p>
                Agencies, counties, statewide programs, and approved CAD/RMS collaborators can use this form — we
                acknowledge every submission on business hours. Procurement teams may also coordinate through your IT or
                finance channel.
              </p>
              <ContactSalesForm
                interestFromSearch={interestFromSearch}
                onSuccess={({ leadId }) => {
                  setCompletion({ submittedAt: new Date(), referenceId: leadId ?? null });
                }}
              />
              <p className="mt-8 text-xs text-slate-500">
                <Link href={home} className="text-sky-400/90 hover:text-sky-300">
                  Home
                </Link>
                <span className="mx-2 text-slate-600">/</span>
                <Link href={pricing} className="text-sky-400/90 hover:text-sky-300">
                  Pricing
                </Link>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="flow-success"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
              }
            >
              <ContactSuccessCard
                referenceId={completion.referenceId}
                submittedAt={completion.submittedAt}
              />
              <p className="mt-10 text-center text-xs text-slate-500">
                <Link href={home} className="text-sky-400/90 hover:text-sky-300">
                  Home
                </Link>
                <span className="mx-2 text-slate-600">/</span>
                <Link href={pricing} className="text-sky-400/90 hover:text-sky-300">
                  Pricing
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}
