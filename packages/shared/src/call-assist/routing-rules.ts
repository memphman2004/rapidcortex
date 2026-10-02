import { z } from "zod";

export const CALL_ASSIST_DELIVERY_METHODS = [
  "dashboard",
  "email",
  "sms",
  "webhook",
  "cad_writeback",
] as const;
export type CallAssistDeliveryMethod = (typeof CALL_ASSIST_DELIVERY_METHODS)[number];

export const callAssistTimeWindowSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1).max(64),
});
export type CallAssistTimeWindow = z.infer<typeof callAssistTimeWindowSchema>;

export const callAssistRoutingDestinationSchema = z.object({
  departmentId: z.string().min(1).max(64),
  deliveryMethods: z.array(z.enum(CALL_ASSIST_DELIVERY_METHODS)).min(1),
  notifyEmails: z.array(z.string().email()).max(20).optional(),
  notifyPhones: z.array(z.string().min(8).max(32)).max(20).optional(),
  webhookUrl: z.string().url().optional(),
  cadWriteBack: z.boolean().optional(),
  requiresAcknowledgement: z.boolean().default(true),
  slaMinutes: z.number().int().min(1).max(24 * 60).optional(),
});
export type CallAssistRoutingDestination = z.infer<typeof callAssistRoutingDestinationSchema>;

export const callAssistRoutingRuleSchema = z.object({
  agencyId: z.string().min(1).max(128),
  ruleId: z.string().min(1).max(64),
  priority: z.number().int().min(0).max(10_000),
  enabled: z.boolean().default(true),
  conditions: z.object({
    incidentTypes: z.array(z.string().min(1).max(64)).max(50).optional(),
    geographicZones: z.array(z.string().min(1).max(64)).max(50).optional(),
    timeWindows: z.array(callAssistTimeWindowSchema).max(14).optional(),
    minimumDangerScore: z.number().min(0).max(1).optional(),
  }),
  destination: callAssistRoutingDestinationSchema,
});
export type CallAssistRoutingRule = z.infer<typeof callAssistRoutingRuleSchema>;

export const callAssistTransferTargetSchema = z.object({
  agencyId: z.string().min(1).max(128),
  departmentId: z.string().min(1).max(64),
  transferType: z.enum(["QUEUE", "EXTENSION", "EXTERNAL_NUMBER", "SIP_URI"]),
  target: z.string().min(1).max(256),
  businessHoursOnly: z.boolean().default(false),
  afterHoursFallback: z.string().max(256).optional(),
  timeoutSeconds: z.number().int().min(5).max(600).default(30),
  noAnswerFallback: z.string().max(256).optional(),
});
export type CallAssistTransferTarget = z.infer<typeof callAssistTransferTargetSchema>;

export type CallAssistRouteCallInput = {
  agencyId: string;
  confirmationNumber: string;
  incidentType?: string;
  district?: string;
  zoneId?: string;
  dangerScore?: number;
  createdAt: string;
  rules: CallAssistRoutingRule[];
};

export type CallAssistRouteCallResult = {
  routed: true;
  departmentId: string;
  ruleId: string;
  deliveryMethods: CallAssistDeliveryMethod[];
  destination: CallAssistRoutingDestination;
  fallback: boolean;
};

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return (h ?? 0) * 60 + (m ?? 0);
}

export function matchesCallAssistTimeWindow(
  window: CallAssistTimeWindow,
  atIso: string,
): boolean {
  const at = new Date(atIso);
  let day = at.getUTCDay();
  let minutes = at.getUTCHours() * 60 + at.getUTCMinutes();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: window.timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(at);
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    day = map[wd] ?? day;
    const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "0";
    minutes = (hour === "24" ? 0 : Number(hour)) * 60 + Number(minute);
  } catch {
    /* use UTC */
  }
  if (!window.daysOfWeek.includes(day)) return false;
  const start = parseHm(window.startTime);
  const end = parseHm(window.endTime);
  if (start <= end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

export function matchesCallAssistRoutingRule(
  rule: CallAssistRoutingRule,
  input: Omit<CallAssistRouteCallInput, "rules" | "confirmationNumber">,
): boolean {
  if (rule.enabled === false) return false;
  const { conditions } = rule;
  if (conditions.incidentTypes?.length) {
    const t = (input.incidentType ?? "").trim().toUpperCase();
    if (!conditions.incidentTypes.some((x) => x.trim().toUpperCase() === t)) return false;
  }
  if (conditions.geographicZones?.length) {
    const zone = (input.district ?? input.zoneId ?? "").trim().toUpperCase();
    if (!zone || !conditions.geographicZones.some((x) => x.trim().toUpperCase() === zone)) {
      return false;
    }
  }
  if (conditions.timeWindows?.length) {
    if (!conditions.timeWindows.some((w) => matchesCallAssistTimeWindow(w, input.createdAt))) {
      return false;
    }
  }
  if (conditions.minimumDangerScore != null) {
    if ((input.dangerScore ?? 0) < conditions.minimumDangerScore) return false;
  }
  return true;
}

export function evaluateCallAssistRouting(
  input: CallAssistRouteCallInput,
): CallAssistRouteCallResult {
  const sorted = [...input.rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (
      matchesCallAssistRoutingRule(rule, {
        agencyId: input.agencyId,
        incidentType: input.incidentType,
        district: input.district,
        zoneId: input.zoneId,
        dangerScore: input.dangerScore,
        createdAt: input.createdAt,
      })
    ) {
      return {
        routed: true,
        departmentId: rule.destination.departmentId,
        ruleId: rule.ruleId,
        deliveryMethods: rule.destination.deliveryMethods,
        destination: rule.destination,
        fallback: false,
      };
    }
  }
  const fallbackDest: CallAssistRoutingDestination = {
    departmentId: "SUPERVISOR",
    deliveryMethods: ["dashboard"],
    requiresAcknowledgement: true,
    slaMinutes: 15,
  };
  return {
    routed: true,
    departmentId: "SUPERVISOR",
    ruleId: "DEFAULT_FALLBACK",
    deliveryMethods: ["dashboard"],
    destination: fallbackDest,
    fallback: true,
  };
}

/** Example KC-style seed rules (agencyId filled by seeder). */
export function defaultCallAssistRoutingRules(agencyId: string): CallAssistRoutingRule[] {
  return [
    {
      agencyId,
      ruleId: "suspicious-vehicle-patrol",
      priority: 10,
      enabled: true,
      conditions: { incidentTypes: ["SUSPICIOUS_VEHICLE", "SUSPICIOUS_PERSON"] },
      destination: {
        departmentId: "PATROL",
        deliveryMethods: ["dashboard", "email"],
        requiresAcknowledgement: true,
        slaMinutes: 15,
      },
    },
    {
      agencyId,
      ruleId: "parking-business-hours",
      priority: 20,
      enabled: true,
      conditions: {
        incidentTypes: ["PARKING", "PARKING_VIOLATION"],
        timeWindows: [
          {
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: "08:00",
            endTime: "17:00",
            timezone: "America/Chicago",
          },
        ],
      },
      destination: {
        departmentId: "PARKING",
        deliveryMethods: ["dashboard", "email"],
        requiresAcknowledgement: true,
        slaMinutes: 60,
      },
    },
    {
      agencyId,
      ruleId: "parking-after-hours",
      priority: 25,
      enabled: true,
      conditions: { incidentTypes: ["PARKING", "PARKING_VIOLATION"] },
      destination: {
        departmentId: "PATROL",
        deliveryMethods: ["dashboard"],
        requiresAcknowledgement: true,
        slaMinutes: 30,
      },
    },
    {
      agencyId,
      ruleId: "animal-hours",
      priority: 30,
      enabled: true,
      conditions: {
        incidentTypes: ["ANIMAL", "ANIMAL_COMPLAINT"],
        timeWindows: [
          {
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            startTime: "07:00",
            endTime: "22:00",
            timezone: "America/Chicago",
          },
        ],
      },
      destination: {
        departmentId: "ANIMAL_CONTROL",
        deliveryMethods: ["dashboard", "sms"],
        requiresAcknowledgement: true,
        slaMinutes: 45,
      },
    },
    {
      agencyId,
      ruleId: "welfare-noise-patrol",
      priority: 40,
      enabled: true,
      conditions: { incidentTypes: ["WELFARE_CHECK", "NOISE", "NOISE_COMPLAINT"] },
      destination: {
        departmentId: "PATROL",
        deliveryMethods: ["dashboard"],
        requiresAcknowledgement: true,
        slaMinutes: 20,
      },
    },
  ];
}
