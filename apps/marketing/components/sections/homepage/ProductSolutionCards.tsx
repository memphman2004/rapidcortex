"use client";

import Link from "next/link";
import {
  Building2,
  Eye,
  Headphones,
  MapPinned,
  School,
  TrainFront,
} from "lucide-react";
import { MARKETING_EVENTS, trackMarketingEvent } from "@/lib/marketing-analytics";

const PRODUCTS = [
  {
    name: "911 & Dispatch Intelligence",
    body: "Real-time dispatcher intelligence, live transcription, and CAD integration.",
    href: "/product/core",
    cta: "911 Centers / PSAPs",
    Icon: Headphones,
  },
  {
    name: "NEXiQ Non-Emergency",
    body: "Conversational intelligence for non-emergency and city services.",
    href: "/nexiq",
    cta: "NEXiQ",
    Icon: Building2,
  },
  {
    name: "Campus Safety",
    body: "No-app reporting and campus safety coordination for universities and K-12.",
    href: "/product/campus",
    cta: "Campus Safety",
    Icon: School,
  },
  {
    name: "iQ Vision",
    body: "Video intelligence and incident awareness from connected cameras.",
    href: "/iq-vision",
    cta: "iQ Vision",
    Icon: Eye,
  },
  {
    name: "Venue Security",
    body: "Incident reporting and coordinated security operations for stadiums and events.",
    href: "/product/venue",
    cta: "Venue Safety",
    Icon: MapPinned,
  },
  {
    name: "Transit Safety",
    body: "Rider reporting and transit security visibility across your network.",
    href: "/product/transit",
    cta: "Transit Safety",
    Icon: TrainFront,
  },
] as const;

export function ProductSolutionCards() {
  return (
    <section
      id="explore-product-lines"
      className="scroll-mt-24 bg-slate-950 px-4 py-20 sm:px-6 md:py-24"
      aria-labelledby="products-heading"
    >
      <div className="mx-auto max-w-7xl">
        <h2
          id="products-heading"
          className="rc-title-gradient text-balance text-center text-3xl font-semibold tracking-tight md:text-4xl lg:text-[2.75rem]"
        >
          One platform, Multiple public safety missions
        </h2>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((product) => (
            <li key={product.name}>
              <Link
                href={product.href}
                className="group flex h-full min-h-[11rem] flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-sky-500/40 hover:bg-slate-900/70"
                onClick={() =>
                  trackMarketingEvent(MARKETING_EVENTS.productCardClick, {
                    card_name: product.name,
                    card_href: product.href,
                  })
                }
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300">
                  <product.Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-sky-100">
                  {product.name}
                </h3>
                <p className="mt-2 flex-1 text-base leading-relaxed text-slate-400">{product.body}</p>
                <span className="mt-4 text-sm font-medium text-sky-400 group-hover:text-sky-300">
                  {product.cta} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
