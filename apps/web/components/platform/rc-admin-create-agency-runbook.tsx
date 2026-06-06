import type { CreateAgencyInput } from "rapid-cortex-shared";

const AGENCY_TYPES = [
  "city",
  "county",
  "municipality",
  "regional_center",
  "pilot",
  "state_agency",
] as const satisfies readonly CreateAgencyInput["type"][];

const AGENCY_TYPE_GUIDE: Record<CreateAgencyInput["type"], string> = {
  city: "City / municipal corporation (often PD or combined city ops).",
  county: "County-wide agency or sheriff office.",
  municipality: "Town, village, township, or smaller municipal PSAP.",
  regional_center: "Multi-agency hub, regional ECC, or shared PSAP.",
  pilot: "Trial or evaluation tenant before full rollout.",
  state_agency: "State-level department or statewide program.",
};

/**
 * In-app runbook for Rapid Cortex internal operators (`rcsuperadmin`, `rcadmin`). Shown on Platform → Agencies.
 * Copy aligns with onboarding docs; field names match the create-agency form.
 */
export function RcAdminCreateAgencyRunbook() {
  return (
    <section className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-4 md:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400/90">
        Section A — Rapid Cortex staff
      </p>
      <h2 className="mt-1 text-base font-semibold text-white">A1. Create a new agency account</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
        Complete these steps when onboarding a new public safety agency. Internal operators use the{" "}
        <span className="text-slate-300">Platform command</span> area (requires{" "}
        <span className="font-mono text-slate-300">rcsuperadmin</span> or{" "}
        <span className="font-mono text-slate-300">rcadmin</span>
        ). The sidebar label is <span className="text-slate-300">Agencies</span>; use{" "}
        <span className="text-slate-300">New agency</span> to open the form.
      </p>

      <div className="mt-4 overflow-x-auto rounded-md border border-slate-800">
        <table className="min-w-[520px] w-full text-left text-xs text-slate-300">
          <caption className="border-b border-slate-800 bg-slate-950/80 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Agency type (product values)
          </caption>
          <thead className="border-b border-slate-800 bg-slate-950/50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">When to use</th>
            </tr>
          </thead>
          <tbody>
            {AGENCY_TYPES.map((t) => (
              <tr key={t} className="border-b border-slate-800/80 last:border-0">
                <td className="px-3 py-2 font-mono text-slate-200">{t}</td>
                <td className="px-3 py-2">{AGENCY_TYPE_GUIDE[t]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-100/95">
        <span className="font-medium text-amber-50">County and billing:</span> There is no separate county field —
        enter county, parish, or service area in <span className="font-mono text-amber-200/90">Region</span> (with{" "}
        <span className="font-mono text-amber-200/90">State</span> as the two-letter code).{" "}
        <span className="text-amber-50">Billing plan</span> is not chosen on this form; after the agency exists, use{" "}
        <span className="text-amber-50">Platform → Billing</span> or the agency billing view to align subscription
        status with your account team process.
      </p>

      <p className="mt-3 rounded-md border border-slate-700/80 bg-slate-950/40 px-3 py-2 text-xs leading-relaxed text-slate-400">
        <span className="font-medium text-slate-300">Operational categories</span> (PSAP, law enforcement, fire,
        EMS, multi-agency) map to the table above — pick the product type that best matches how the tenant is
        governed and billed.
      </p>

      <p className="mt-3 rounded-md border border-slate-700/80 bg-slate-950/40 px-3 py-2 text-xs leading-relaxed text-slate-400">
        <span className="font-medium text-slate-300">Onboarding email:</span> Creating an agency does not send an
        automated welcome message from the app. Step 12 is your agency-delivered onboarding (primary contact or IT
        admin), including sign-in instructions and next steps.
      </p>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
        <li>
          Log in at <span className="text-slate-200">rapidcortex.us</span> with your{" "}
          <span className="font-mono text-slate-200">rcsuperadmin</span> or{" "}
          <span className="font-mono text-slate-200">rcadmin</span> credentials.
        </li>
        <li>
          Open <span className="text-slate-200">Platform command → Agencies → New agency</span> (or use the canonical
          RC admin entry point that lands on this directory).
        </li>
        <li>
          Enter <span className="text-slate-200">Agency ID</span> — short slug in{" "}
          <span className="font-mono text-slate-200">locality-state</span> form (lowercase letters, digits, hyphens;
          ends with <span className="font-mono text-slate-200">-xx</span> for the state). This becomes the permanent
          tenant key.
        </li>
        <li>
          Enter <span className="text-slate-200">Agency name</span> — full legal name of the PSAP or agency as it
          should appear in the product.
        </li>
        <li>
          Select <span className="text-slate-200">Type</span> using the reference table (PSAP / law enforcement / fire
          / EMS / multi-agency → closest match).
        </li>
        <li>
          Set <span className="text-slate-200">State</span> (two letters) and <span className="text-slate-200">Region</span>{" "}
          (county, metro, or service area description).
        </li>
        <li>
          Enter <span className="text-slate-200">Primary contact name</span> and{" "}
          <span className="text-slate-200">Primary contact email</span>.
        </li>
        <li>
          Plan billing alignment after creation (see callout above) — not on this form.
        </li>
        <li>
          Click <span className="text-slate-200">Create agency</span>.
        </li>
        <li>
          Confirm the new <span className="font-mono text-slate-200">agencyId</span> on the agency profile; copy it
          for IT admin handoff and internal records.
        </li>
        <li>
          Send the agency IT admin their onboarding communication with login instructions and the tenant identifier.
        </li>
        <li>
          Ask the IT admin to sign in and complete agency setup (CAD integration, user accounts, and billing if
          applicable).
        </li>
      </ol>
    </section>
  );
}
