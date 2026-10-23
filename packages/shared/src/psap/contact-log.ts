import type { PsapActivity, PsapProspect } from "./types.js";

/** Outreach that counts as contacting the prospect. Notes and stage changes do not. */
export const PSAP_CONTACT_METHODS = ["call", "email", "mail", "demo"] as const;
export type PsapContactMethod = (typeof PSAP_CONTACT_METHODS)[number];

export const PSAP_CONTACT_METHOD_LABELS: Record<PsapContactMethod, string> = {
  call: "Call",
  email: "Email",
  mail: "Mail",
  demo: "Demo",
};

export type PsapContactSummary = {
  count: number;
  lastAt?: string;
  lastBy?: string;
  lastMethod?: PsapContactMethod;
};

export function isPsapContactMethod(type: string): type is PsapContactMethod {
  return (PSAP_CONTACT_METHODS as readonly string[]).includes(type);
}

type ContactFields = Pick<
  PsapProspect,
  "activities" | "lastContactedAt" | "lastContactedBy" | "lastContactMethod" | "outreachTouchCount"
>;

/** Count, latest time, person, and method from the activity log. */
export function summarizePsapContacts(prospect: ContactFields): PsapContactSummary {
  const touches = (prospect.activities ?? [])
    .filter((activity): activity is PsapActivity & { type: PsapContactMethod } =>
      isPsapContactMethod(activity.type),
    )
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));

  const latest = touches[0];
  if (latest) {
    return {
      count: touches.length,
      lastAt: latest.performedAt,
      lastBy: latest.performedByName,
      lastMethod: latest.type,
    };
  }

  if (prospect.lastContactedAt) {
    const stored = prospect.outreachTouchCount;
    return {
      count: typeof stored === "number" && stored > 0 ? stored : 1,
      lastAt: prospect.lastContactedAt,
      lastBy: prospect.lastContactedBy,
      lastMethod: prospect.lastContactMethod,
    };
  }

  return { count: 0 };
}

/** Copy the contact summary onto the prospect so list rows do not rescan the log. */
export function stampPsapContactFields<T extends PsapProspect>(prospect: T): T {
  const summary = summarizePsapContacts(prospect);
  return {
    ...prospect,
    outreachTouchCount: summary.count,
    ...(summary.lastAt ? { lastContactedAt: summary.lastAt } : {}),
    ...(summary.lastBy ? { lastContactedBy: summary.lastBy } : {}),
    ...(summary.lastMethod ? { lastContactMethod: summary.lastMethod } : {}),
  };
}
