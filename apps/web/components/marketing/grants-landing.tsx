import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Check,
  ClipboardList,
  Clock,
  FileText,
  RefreshCw,
  Scale,
  Target,
  Wallet,
} from "lucide-react";
import { marketingDemoRequestPath } from "@/lib/marketing-links";
import { GrantsHowItWorks } from "./grants-how-it-works";

const DEMO_HREF = marketingDemoRequestPath("demo");

const STATS = [
  { value: "$2.4B", label: "in 911 grant funding available annually" },
  { value: "40%", label: "of eligible agencies never apply" },
  { value: "30s", label: "to generate a complete narrative" },
  { value: "$0", label: "additional cost for RC customers" },
] as const;

const PROBLEMS: ReadonlyArray<{ Icon: LucideIcon; stat: string; title: string; body: string }> = [
  {
    Icon: Clock,
    stat: "80+",
    title: "Hours to write one grant",
    body: "A competitive federal grant application takes a skilled writer 80–120 hours. Most dispatch centers don't have a dedicated grant writer on staff.",
  },
  {
    Icon: ClipboardList,
    stat: "12+",
    title: "Grant programs available right now",
    body: "COPS, NG911, Byrne JAG, ARPA, FEMA HSGP, state criminal justice funds — most agencies know about one or two. Rapid Cortex knows all of them.",
  },
  {
    Icon: Wallet,
    stat: "$0",
    title: "Spent on grant consultants",
    body: "Grant consultants charge $5,000–$25,000 per application. That budget often doesn't exist. RC eliminates the cost entirely.",
  },
];

const PROGRAMS = [
  {
    agency: "U.S. Dept. of Justice",
    name: "COPS Technology Program",
    amount: "Up to $500K",
    desc: "Funds technology to enhance the capacity of law enforcement agencies. Strong fit for dispatch intelligence, AI-assisted CAD, and officer safety tools.",
    tag: "High fit for 911 agencies",
  },
  {
    agency: "NTIA / FCC",
    name: "NG911 Grant Program",
    amount: "Up to $2M",
    desc: "Funds transition to Next Generation 911 infrastructure, including AI-powered call handling, real-time data, and interoperability improvements.",
    tag: "High fit for PSAPs",
  },
  {
    agency: "U.S. Dept. of Justice",
    name: "Edward Byrne JAG",
    amount: "Varies by state",
    desc: "Block grants distributed through states for criminal justice improvements including technology, training, and communications upgrades.",
    tag: "Available in all 50 states",
  },
  {
    agency: "U.S. Treasury",
    name: "ARPA / SLFRF",
    amount: "Varies by jurisdiction",
    desc: "American Rescue Plan funds that many counties are directing toward public safety technology modernization through 2026 spending deadlines.",
    tag: "Deadline-sensitive",
  },
  {
    agency: "FEMA",
    name: "Homeland Security Grant Program",
    amount: "Up to $1M",
    desc: "State-administered grants for emergency preparedness, interoperability, and communications infrastructure for first responders and EOCs.",
    tag: "Strong EMS / fire fit",
  },
  {
    agency: "State Programs",
    name: "State Criminal Justice & 911 Funds",
    amount: "Varies",
    desc: "State-level 911 boards and criminal justice agencies administer their own grant programs. Rapid Cortex tracks active programs in all 50 states.",
    tag: "All 50 states tracked",
  },
] as const;

const DELIVERABLES: ReadonlyArray<{ Icon: LucideIcon; title: string; body: string }> = [
  {
    Icon: FileText,
    title: "Executive Summary",
    body: "Agency-specific narrative covering the problem, proposed solution, and expected outcomes — written to the program's evaluation criteria.",
  },
  {
    Icon: BarChart3,
    title: "Statement of Need",
    body: "Data-driven problem statement using your agency's call volume, staffing levels, and technology gaps to make the case for funding.",
  },
  {
    Icon: Clock,
    title: "Implementation Timeline",
    body: "Phase-by-phase deployment plan with milestones from contract award through go-live and post-implementation support periods.",
  },
  {
    Icon: Wallet,
    title: "Budget Narrative",
    body: "Line-item budget with written justification for every cost — platform licensing, implementation, training, and multi-year support.",
  },
  {
    Icon: Target,
    title: "Goals & Objectives",
    body: "Measurable outcomes tied to your agency's specific operational challenges — response time, QA scores, dispatcher efficiency, and more.",
  },
  {
    Icon: Scale,
    title: "Evaluation Plan",
    body: "How you'll measure success — metrics, data collection methods, and reporting cadence that satisfies program monitoring requirements.",
  },
  {
    Icon: RefreshCw,
    title: "Sustainability Plan",
    body: "How the agency will maintain the program after the grant period ends — required by most federal programs and written to their specific language.",
  },
  {
    Icon: FileText,
    title: "Word Document (.docx)",
    body: "Formatted .docx file downloads to your device, ready to review and submit. Edit any section before filing — it's your document to own.",
  },
];

function GrantPreviewCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-[0_10px_30px_-20px_rgba(56,189,248,0.45)]">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-3">
        <span className="size-2.5 rounded-full bg-slate-700" aria-hidden />
        <span className="size-2.5 rounded-full bg-slate-700" aria-hidden />
        <span className="size-2.5 rounded-full bg-slate-700" aria-hidden />
        <span className="ml-2 font-mono text-[11px] text-slate-500">Grant Success Program</span>
        <span className="ml-auto rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
          AI writing
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-4 grid grid-cols-4 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide">
          {["Agency", "Grant", "Project", "Generating"].map((label, i) => (
            <div
              key={label}
              className={`border-b-2 pb-2 ${i < 3 ? "border-emerald-500/70 text-emerald-400" : "border-sky-500 text-sky-300"}`}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">
            Jefferson County Sheriff's Office · Idaho
          </p>
          <p className="mt-1 text-sm font-semibold text-white">COPS Technology Program Application</p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
            Solicitation O-COPS-2026-171368 · Amount: $185,000
          </p>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Executive Summary
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            The Jefferson County Sheriff's Office respectfully requests $185,000 to deploy the Rapid
            Cortex AI-powered emergency communications intelligence platform across its consolidated
            911 dispatch center serving 34,854 residents.
            <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-sky-400 align-middle" />
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            {[
              ["Platform license", "$42,000"],
              ["Implementation", "$18,000"],
              ["Training", "$12,000"],
              ["Year 2–3 support", "$113,000"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-sky-200">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-sky-500/20 bg-sky-950/30 px-3 py-2.5">
            <span
              className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-400"
              aria-hidden
            />
            <p className="font-mono text-[11px] text-sky-200">Writing NIBRS compliance section...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GrantsLanding() {
  return (
    <article className="w-full">
      <section className="relative overflow-hidden border-b border-slate-800/80">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
              Grant Success Program · Free for all agencies
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Your agency deserves the technology. We help you pay for it.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
              Rapid Cortex includes a free AI grant writer that generates complete, ready-to-submit
              grant applications — COPS, NG911, Byrne JAG, ARPA, and more.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={DEMO_HREF}
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500"
              >
                Request a demo
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-600/90 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 backdrop-blur-sm hover:border-slate-500"
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <Check className="size-4 shrink-0 text-emerald-400" aria-hidden />
              <span>
                <strong className="font-medium text-emerald-400">Included free</strong> — no additional
                license, no add-on fee
              </span>
            </p>
          </div>
          <GrantPreviewCard />
        </div>
      </section>

      <section className="border-b border-slate-800/80 bg-slate-950">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {STATS.map((item) => (
            <div key={item.value}>
              <p className="font-mono text-3xl font-semibold tracking-tight text-sky-300">{item.value}</p>
              <p className="mt-1 text-sm leading-snug text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
          The problem agencies face
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Billions in funding go unclaimed every year.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          911 centers are underfunded, understaffed, and running on aging technology. The grant money
          to fix this exists — most agencies just don't have the time or expertise to write for it.
        </p>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {PROBLEMS.map((item) => (
            <li key={item.title} className="rounded-lg border border-slate-800 bg-slate-900/30 p-6">
              <item.Icon className="h-5 w-5 text-sky-300" aria-hidden />
              <p className="mt-4 font-mono text-3xl font-semibold text-sky-200">{item.stat}</p>
              <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="how-it-works" className="border-y border-slate-800/80 bg-slate-900/20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">How it works</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Four steps. Under five minutes.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Fill in your agency's basic information and the grant program you're targeting. Rapid
            Cortex writes the rest — narrative, budget justification, NIBRS classification,
            implementation timeline, and more.
          </p>
          <GrantsHowItWorks />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
          Supported grant programs
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Every major public safety funding source — covered.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          Rapid Cortex writes for the programs your agency actually qualifies for. Each application is
          written to the specific evaluation criteria and language requirements of that program — not
          a generic template.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMS.map((program) => (
            <li
              key={program.name}
              className="rounded-lg border border-slate-800 bg-slate-900/30 p-6 transition-colors hover:border-slate-700"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {program.agency}
              </p>
              <h3 className="mt-2 text-base font-semibold text-white">{program.name}</h3>
              <p className="mt-1 font-mono text-lg font-semibold text-sky-300">{program.amount}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{program.desc}</p>
              <p className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
                {program.tag}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-slate-800/80 bg-slate-900/20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
            What gets generated
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            A complete application. Not a template.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Every document is written specifically for your agency, your grant program, and your
            operational situation. Download as a formatted Word document and submit directly.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DELIVERABLES.map((item) => (
              <li key={item.title} className="rounded-lg border border-slate-800 bg-slate-900/30 p-5">
                <item.Icon className="h-5 w-5 text-sky-300" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-xl border border-sky-800/40 bg-sky-950/20 px-6 py-12 text-center sm:px-10 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
            Included at no additional cost
          </p>
          <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
            The technology you need. The funding to get it.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            The Grant Success Program is included with every Rapid Cortex subscription — Essential,
            Professional, and Enterprise. No extra license. No consulting fee. No grant writer on
            staff required.
          </p>
          <Link
            href={DEMO_HREF}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-md bg-sky-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500"
          >
            Request a demo
          </Link>
          <p className="mx-auto mt-5 max-w-lg text-sm text-slate-400">
            Questions about grant eligibility? Our team can review your agency's situation and
            identify which programs you qualify for — at no cost.
          </p>
        </div>
      </section>
    </article>
  );
}
