"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type FaqItem = { q: string; a: string };

const FAQS: FaqItem[] = [
  {
    q: "Can pricing be structured around grant funding?",
    a: "Yes. We work with agencies to align pricing with BRIC, state PSAP grant cycles, and E911 surcharge fund timelines. We provide budget estimates in the format your grant application requires, including per-unit cost documentation and performance justifications. Contact us early in your grant cycle — we can help shape the technical specification language to support your application.",
  },
  {
    q: "Do you support sole-source procurement?",
    a: "Yes. NexCortiQ provides sole-source justification documentation upon request, citing proprietary AI architecture, unique public safety integrations, and the operational continuity risk of multi-vendor alternatives. We have supported sole-source justifications for state and local procurement offices across multiple states.",
  },
  {
    q: "What does the 60-day pilot include?",
    a: "Full platform access at your selected tier, hands-on onboarding support, a dedicated success manager, and weekly operational check-ins. Pilot agencies receive access to all core modules relevant to their agency type. No obligation to continue after the pilot — your data is fully exportable or purged upon request at no cost.",
  },
  {
    q: "How long does onboarding and deployment take?",
    a: "Starter tier with no CAD integration can be live in 7–14 days. Professional or Command tier with CAD read integration typically takes 2–4 weeks. Enterprise or statewide deployments involving CAD write-back and custom integrations are planned over a 6–12 week implementation timeline. All timelines are confirmed in your Agency Pilot Scope Agreement before kickoff.",
  },
  {
    q: "Do you have state contract vehicles or cooperative purchasing agreements?",
    a: "We are actively pursuing NASPO/WSCA ValuePoint, Sourcewell, and state-specific technology contract vehicles. Contact us to discuss current options in your state — in some cases we can fast-track under an existing technology services contract your agency already holds. Piggyback purchasing from agencies with an executed NexCortiQ agreement is also supported where your state rules permit.",
  },
  {
    q: "What happens to our data after the pilot?",
    a: "All incident data is stored in an isolated AWS environment dedicated to your agency — not commingled with other agencies' data. Data is fully exportable in standard formats at any time during or after the pilot. If you choose not to continue, we provide a 30-day export window and then purge your data upon your documented request. Data residency and retention terms are defined in your Pilot Scope Agreement before kickoff.",
  },
  {
    q: "Is NexCortiQ CJIS-compliant?",
    a: "NexCortiQ is designed with CJIS Security Policy alignment as a core architectural principle — including access controls, audit logging, encryption in transit and at rest, and personnel security awareness requirements for applicable staff. We provide a CJIS Security Addendum and can support your agency's security review process. CJIS compliance is a shared responsibility between NexCortiQ and your agency — we provide documentation and architecture to support your posture.",
  },
  {
    q: "Can we start with one module and expand later?",
    a: "Yes — that is the most common path. Many agencies start with Call Assist AI and transcription, then add CAD integration, QA tools, and intelligence modules as operational confidence grows. Licensing is modular and can be expanded mid-contract without penalty. This approach also simplifies dispatcher training and change management.",
  },
];

function FaqAccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-medium text-slate-200 transition-colors hover:text-white"
      >
        <span>{item.q}</span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="pb-5 text-sm leading-relaxed text-slate-400">{item.a}</div>
      )}
    </div>
  );
}

export function PricingFaq() {
  return (
    <div>
      {FAQS.map((item) => (
        <FaqAccordionItem key={item.q} item={item} />
      ))}
    </div>
  );
}
