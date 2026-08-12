import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";

const RUNSIGNUP_BASE = "https://runsignup.com/Rest";
const RUNSIGNUP_SECRET_ARN = process.env.RAPID_IQ_RUNSIGNUP_CREDENTIALS_SECRET_ARN ?? "";

export type RunSignUpCredentials = {
  token: string;
  secret: string;
};

export type RunSignUpRace = {
  race_id: number;
  name: string;
  next_date: string;
  next_end_date: string;
  address: {
    city: string;
    state: string;
    zipcode: string;
  };
  url: string;
  registration_opens: string;
  max_participants: number | null;
  participant_cap: number | null;
  description: string;
  events: {
    event_id: number;
    name: string;
    distance: string;
    registration_opens: string;
  }[];
  race_director: {
    name: string;
    email: string;
  } | null;
};

let cachedCredentials: RunSignUpCredentials | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRunSignUpConfigured(): boolean {
  return Boolean(RUNSIGNUP_SECRET_ARN.trim());
}

async function getCredentials(): Promise<RunSignUpCredentials | null> {
  if (cachedCredentials) return cachedCredentials;
  if (!RUNSIGNUP_SECRET_ARN.trim()) return null;

  const token = (
    await resolvePlainOrSecretArn(undefined, RUNSIGNUP_SECRET_ARN, { preferredField: "token" })
  ).trim();
  const secret = (
    await resolvePlainOrSecretArn(undefined, RUNSIGNUP_SECRET_ARN, { preferredField: "secret" })
  ).trim();
  if (!token || !secret) {
    console.warn(
      JSON.stringify({
        msg: "runsignup_credentials_incomplete",
        hasToken: Boolean(token),
        hasSecret: Boolean(secret),
      }),
    );
    return null;
  }
  cachedCredentials = { token, secret };
  return cachedCredentials;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value != null ? String(value) : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseRace(raw: unknown): RunSignUpRace | null {
  const race = asRecord(raw);
  if (!race) return null;
  const raceId = asNumber(race.race_id);
  const name = asString(race.name).trim();
  if (!raceId || !name) return null;

  const address = asRecord(race.address) ?? {};
  const director = asRecord(race.race_director);
  const eventsRaw = Array.isArray(race.events) ? race.events : [];

  return {
    race_id: raceId,
    name,
    next_date: asString(race.next_date),
    next_end_date: asString(race.next_end_date),
    address: {
      city: asString(address.city),
      state: asString(address.state),
      zipcode: asString(address.zipcode),
    },
    url: asString(race.url),
    registration_opens: asString(race.registration_opens),
    max_participants: asNumber(race.max_participants),
    participant_cap: asNumber(race.participant_cap),
    description: asString(race.description),
    events: eventsRaw
      .map((ev) => {
        const e = asRecord(ev);
        if (!e) return null;
        const eventId = asNumber(e.event_id) ?? 0;
        const eventName = asString(e.name).trim();
        if (!eventName) return null;
        return {
          event_id: eventId,
          name: eventName,
          distance: asString(e.distance),
          registration_opens: asString(e.registration_opens),
        };
      })
      .filter((e): e is RunSignUpRace["events"][number] => Boolean(e)),
    race_director:
      director && asString(director.name).trim()
        ? { name: asString(director.name).trim(), email: asString(director.email) }
        : null,
  };
}

/** Search upcoming races by state. Registration headers required starting Jan 1, 2027. */
export async function searchUpcomingRaces(
  state: string,
  startDate: Date,
  endDate: Date,
  minParticipants = 500,
): Promise<RunSignUpRace[]> {
  const creds = await getCredentials();
  if (!creds) return [];

  const params = new URLSearchParams({
    format: "json",
    state,
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
    events: "T",
    race_headings: "T",
    race_state: "A",
    per_page: "50",
    page: "1",
  });

  await sleep(600);
  const res = await fetch(`${RUNSIGNUP_BASE}/races?${params}`, {
    headers: {
      Accept: "application/json",
      // Registration headers — required from Jan 1, 2027.
      // Verify exact header names in RunSignUp API Caller registration docs.
      "RS-Registration-Token": creds.token,
      "RS-Registration-Secret": creds.secret,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    console.warn(JSON.stringify({ msg: "runsignup_http_error", status: res.status, state }));
    return [];
  }

  const data: unknown = await res.json();
  const root = asRecord(data);
  const racesRaw = Array.isArray(root?.races) ? root.races : [];
  const races = racesRaw
    .map((entry) => {
      const wrapper = asRecord(entry);
      return parseRace(wrapper?.race ?? entry);
    })
    .filter((r): r is RunSignUpRace => Boolean(r));

  return races.filter((race) => {
    const cap = race.participant_cap ?? race.max_participants ?? 0;
    return cap === 0 || cap >= minParticipants;
  });
}

export function buildRaceSignal(race: RunSignUpRace, daysUntilRace: number): string {
  return [
    `Event: ${race.name}`,
    `Location: ${race.address.city}, ${race.address.state}`,
    `Date: ${race.next_date}`,
    `Days until event: ${daysUntilRace}`,
    `Distance types: ${race.events.map((e) => e.name).join(", ")}`,
    `Participant cap: ${race.participant_cap ?? "Not specified (open)"}`,
    `Race website: ${race.url}`,
    `Description: ${race.description?.slice(0, 500)}`,
    `Signal: This is an upcoming large-scale public event that requires real-time`,
    `incident reporting, medical coordination, and crowd safety management.`,
    `Rapid Cortex Venue's QR-based incident reporting, live camera integration,`,
    `and operations dashboard directly address race day safety coordination needs.`,
  ].join("\n");
}

export function clearRunSignUpCredentialsCacheForTests(): void {
  cachedCredentials = null;
}
