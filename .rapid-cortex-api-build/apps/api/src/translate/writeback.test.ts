import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranslateSession } from "rapid-cortex-shared";
import {
  buildAssistanceEncounter,
  hasWritebackTarget,
  linkedIncidentIdForSession,
  queueVerticalWriteback,
} from "./writeback.js";

const putAssistanceEncounter = vi.fn(async () => undefined);
const putSession = vi.fn(async () => undefined);

vi.mock("./store.js", () => ({
  translateStore: {
    putAssistanceEncounter: (...args: unknown[]) => putAssistanceEncounter(...args),
    putSession: (...args: unknown[]) => putSession(...args),
  },
}));

vi.mock("../lib/env.js", () => ({
  env: {
    cadWritebackEnabled: false,
    venueApiUrl: "",
    campusApiUrl: "",
    hospitalApiUrl: "",
    internalApiKey: "",
    translateAudioBucket: "",
  },
}));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    async create() {
      return undefined;
    }
  },
}));

function session(over: Partial<TranslateSession> = {}): TranslateSession {
  return {
    sessionId: "xlat_1",
    agencyId: "kcpd",
    officerId: "u1",
    primaryLanguage: "en",
    subjectLanguage: "es",
    subjectLanguageDetected: true,
    status: "CLOSED",
    startedAt: "2026-09-08T00:00:00.000Z",
    endedAt: "2026-09-08T00:10:00.000Z",
    segmentCount: 1,
    cadWritebackStatus: "NONE",
    monitorUserIds: [],
    sessionUrl: "https://app.example.test/translate/xlat_1",
    vertical: "campus",
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:10:00.000Z",
    ...over,
  };
}

describe("translate write-back targets", () => {
  it("requires an incident for law enforcement", () => {
    expect(hasWritebackTarget(session({ vertical: "law_enforcement" }), "law_enforcement")).toBe(
      false,
    );
    expect(
      hasWritebackTarget(
        session({ vertical: "law_enforcement", incidentId: "inc-1" }),
        "law_enforcement",
      ),
    ).toBe(true);
  });

  it("routes venue and hospital to their context ids", () => {
    expect(
      hasWritebackTarget(
        session({ vertical: "venue", venueContext: { venueCode: "MBS", venueIncidentId: "v1" } }),
        "venue",
      ),
    ).toBe(true);
    expect(
      hasWritebackTarget(
        session({
          vertical: "hospital",
          hospitalContext: { hospitalId: "h1", patientEncounterId: "e1" },
        }),
        "hospital",
      ),
    ).toBe(true);
  });
});

describe("translate assistance encounters", () => {
  beforeEach(() => {
    putAssistanceEncounter.mockClear();
    putSession.mockClear();
  });

  it("builds standalone encounter when no incident is linked", () => {
    const row = buildAssistanceEncounter(session({ campusContext: { campusCode: "ku" } }));
    expect(row.standalone).toBe(true);
    expect(row.linkedIncidentId).toBeUndefined();
    expect(row.assistMonth).toBe("2026-09");
    expect(row.durationSec).toBe(600);
  });

  it("links campus incident id when present", () => {
    const s = session({
      campusContext: { campusCode: "ku", campusIncidentId: "camp-9" },
    });
    expect(linkedIncidentIdForSession(s)).toBe("camp-9");
    const row = buildAssistanceEncounter(s);
    expect(row.standalone).toBe(false);
    expect(row.linkedIncidentId).toBe("camp-9");
  });

  it("persists assistance encounter when closing with no incident target", async () => {
    const result = await queueVerticalWriteback({
      session: session({ campusContext: { campusCode: "ku" } }),
      summary: "summary",
      segments: [],
      actorId: "u1",
    });
    expect(result.queued).toBe(true);
    expect(result.assistanceId).toBe("assist_xlat_1");
    expect(putAssistanceEncounter).toHaveBeenCalledTimes(1);
    const saved = putAssistanceEncounter.mock.calls[0]?.[0] as { standalone: boolean };
    expect(saved.standalone).toBe(true);
  });

  it("persists assistance encounter even when an incident is linked", async () => {
    const result = await queueVerticalWriteback({
      session: session({
        campusContext: { campusCode: "ku", campusIncidentId: "camp-1" },
      }),
      summary: "summary",
      segments: [],
      actorId: "u1",
      skipIncidentNote: true,
    });
    expect(result.assistanceId).toBe("assist_xlat_1");
    expect(putAssistanceEncounter).toHaveBeenCalledTimes(1);
  });
});
