/**
 * Campus Blue-Light Connect — Vendor-Neutral Activation Adapter.
 * Normalizes all three ingest formats into a single internal event.
 * Campus vertical only.
 */

import { randomUUID } from "crypto";
import type {
  NormalizedActivationEvent,
  RawActivationPayload,
  SipActivationPayload,
  SimulatedActivationPayload,
  WebhookActivationPayload,
} from "rapid-cortex-shared";
import type { BlueLightRegistry } from "./blue-light-registry.js";

export class ActivationAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ActivationAdapterError";
  }
}

export class ActivationAdapter {
  constructor(private readonly registry: BlueLightRegistry) {}

  async normalize(raw: RawActivationPayload): Promise<NormalizedActivationEvent> {
    const eventId = randomUUID();
    const receivedAt = new Date().toISOString();

    switch (raw.event) {
      case "button_press":
        return this.normalizeWebhook(raw, eventId, receivedAt);
      case "sip_call":
        return this.normalizeSip(raw, eventId, receivedAt);
      case "simulated":
        return this.normalizeSimulated(raw, eventId, receivedAt);
    }
  }

  // ── Format A: Webhook ───────────────────────────────────────────────────────

  private async normalizeWebhook(
    raw: WebhookActivationPayload,
    eventId: string,
    receivedAt: string,
  ): Promise<NormalizedActivationEvent> {
    const pole = await this.registry.getPoleById(raw.poleId);
    if (!pole) {
      throw new ActivationAdapterError(`Unknown pole: ${raw.poleId}`, "POLE_NOT_FOUND");
    }
    if (pole.status !== "active") {
      throw new ActivationAdapterError(
        `Pole ${raw.poleId} is ${pole.status} — activation rejected`,
        "POLE_INACTIVE",
      );
    }
    return {
      eventId,
      eventType: "button_press",
      poleId: pole.poleId,
      campusId: pole.campusId,
      callId: null,
      rawPayload: raw,
      receivedAt,
    };
  }

  // ── Format B: SIP Call ──────────────────────────────────────────────────────

  private async normalizeSip(
    raw: SipActivationPayload,
    eventId: string,
    receivedAt: string,
  ): Promise<NormalizedActivationEvent> {
    const pole = await this.registry.getPoleBySipExtension(raw.sipExtension);
    if (!pole) {
      throw new ActivationAdapterError(
        `No pole mapped to SIP extension: ${raw.sipExtension}`,
        "SIP_EXTENSION_NOT_MAPPED",
      );
    }
    return {
      eventId,
      eventType: "sip_call",
      poleId: pole.poleId,
      campusId: pole.campusId,
      callId: raw.callId,
      rawPayload: raw,
      receivedAt,
    };
  }

  // ── Format C: Simulation ────────────────────────────────────────────────────

  private async normalizeSimulated(
    raw: SimulatedActivationPayload,
    eventId: string,
    receivedAt: string,
  ): Promise<NormalizedActivationEvent> {
    const pole = await this.registry.getPoleById(raw.poleId);
    if (!pole) {
      throw new ActivationAdapterError(
        `Simulated activation for unknown pole: ${raw.poleId}`,
        "POLE_NOT_FOUND",
      );
    }
    return {
      eventId,
      eventType: "simulated",
      poleId: pole.poleId,
      campusId: pole.campusId,
      callId: raw.simulatedCallId ?? null,
      rawPayload: raw,
      receivedAt,
    };
  }
}
