/**
 * Mock adapter implementations for Scenario Center.
 * These replace production adapters during simulations.
 * All external side effects are suppressed.
 *
 * DEFENSE IN DEPTH: production SMS / CAD paths also check `isDemoIncident`
 * and refuse live dispatch even if ScenarioRunner is the only caller.
 */

import { ScenarioError } from "rapid-cortex-shared";
import { WebSocketNotificationService } from "../services/websocketNotificationService.js";

const ws = new WebSocketNotificationService();

export class MockSmsAdapter {
  private readonly log: Array<{ to: string; body: string; ts: string }> = [];

  async send(to: string, body: string): Promise<{ success: true; blocked: true }> {
    if (!to.startsWith("+15550")) {
      throw new ScenarioError(
        "INVALID_DEMO_PHONE",
        `Demo SMS target ${to} is not a demo number. Use +15550XXXXXX format.`,
      );
    }
    this.log.push({ to, body, ts: new Date().toISOString() });
    console.info(`[DEMO SMS] To: ${to} | Body: "${body.substring(0, 80)}..."`);
    return { success: true, blocked: true };
  }

  getSentMessages() {
    return this.log;
  }
}

export class MockCadAdapter {
  private readonly log: Array<{ event: string; payload: unknown; ts: string }> = [];

  async dispatch(payload: unknown): Promise<{ success: true; blocked: true; reason: string }> {
    this.log.push({ event: "dispatch", payload, ts: new Date().toISOString() });
    console.info("[DEMO CAD] Dispatch blocked — mock adapter");
    return { success: true, blocked: true, reason: "DEMO_INCIDENT" };
  }

  async submit(payload: unknown): Promise<{ success: true; blocked: true }> {
    this.log.push({ event: "submit", payload, ts: new Date().toISOString() });
    return { success: true, blocked: true };
  }

  getCadLog() {
    return this.log;
  }
}

export class BlockedE911Adapter {
  async dispatch(_payload: unknown): Promise<never> {
    throw new ScenarioError(
      "E911_HARD_BLOCK",
      "CRITICAL: 911 adapter was called with a demo incident. " +
        "This is a bug — check the call stack and fix the condition guard.",
    );
  }
}

export class PresetAiAdapter {
  constructor(
    private readonly presets: Record<
      string,
      { summary: string; confidence: number; fields: Record<string, string> }
    >,
  ) {}

  async generateSummary(incidentType: string, message: string) {
    const preset = this.presets[incidentType];
    if (preset) return preset;
    return {
      summary: `[DEMO] Simulated AI summary for ${incidentType}: ${message.substring(0, 100)}`,
      confidence: 0.85,
      fields: {},
    };
  }
}

export class DemoVideoAdapter {
  getStreamUrl(cameraId: string): string {
    const demoStreams: Record<string, string> = {
      "cam-arnett-lobby-north": "https://demo.rapidcortex.us/streams/demo-lobby-1",
      "cam-arnett-lobby-south": "https://demo.rapidcortex.us/streams/demo-lobby-2",
      "cam-shaw-north-lot-1": "https://demo.rapidcortex.us/streams/demo-parking-1",
      "cam-sec110-north": "https://demo.rapidcortex.us/streams/demo-venue-1",
    };
    return demoStreams[cameraId] ?? "https://demo.rapidcortex.us/streams/demo-default";
  }
}

export type ScenarioMockAdapters = {
  sms: MockSmsAdapter;
  cad: MockCadAdapter;
  e911: BlockedE911Adapter;
  ai: PresetAiAdapter;
  camera: DemoVideoAdapter;
  realtime: {
    broadcastIncidentCreated(params: {
      agencyId: string;
      incidentId: string;
      source: string;
    }): Promise<void>;
  };
};

export function buildMockAdapters(opts?: {
  aiPresets?: Record<string, { summary: string; confidence: number; fields: Record<string, string> }>;
}): ScenarioMockAdapters {
  return {
    sms: new MockSmsAdapter(),
    cad: new MockCadAdapter(),
    e911: new BlockedE911Adapter(),
    ai: new PresetAiAdapter(opts?.aiPresets ?? {}),
    camera: new DemoVideoAdapter(),
    realtime: {
      async broadcastIncidentCreated(params) {
        await ws.broadcastIncidentCreated(params);
      },
    },
  };
}
