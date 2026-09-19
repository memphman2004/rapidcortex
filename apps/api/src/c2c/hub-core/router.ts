import type { ICadAdapter } from "../cad-adapters/adapter.interface.js";
import { validateEido } from "../eido/validator.js";
import type {
  EidoDiff,
  EidoDispatchConfirmation,
  EidoEnvelope,
  EidoTransferRequest,
  EidoUnitStatusUpdate,
} from "../eido/types.js";
import { RedactionEngine } from "../redaction/engine.js";
import type { TransferRulesEngine } from "../transfer-rules/engine.js";
import { AuditLogger } from "./audit.js";
import { HeartbeatMonitor } from "../health/heartbeat.js";
import { AgencyRegistry } from "./registry.js";
import { IncidentTracker } from "./incident-tracker.js";
import { MessageQueue } from "./message-queue.js";
import type { C2CMessageType, FanOutResult, RoutingResult, RoutingTargetResult } from "./types.js";

export class HubRouter {
  constructor(
    private readonly registry: AgencyRegistry,
    private readonly rules: TransferRulesEngine,
    private readonly redaction: RedactionEngine,
    private readonly adapters: Map<string, ICadAdapter>,
    private readonly audit: AuditLogger,
    private readonly health: HeartbeatMonitor,
    private readonly tracker: IncidentTracker = new IncidentTracker(),
    private readonly queue: MessageQueue = new MessageQueue(),
  ) {}

  async routeNewIncident(eido: EidoEnvelope): Promise<RoutingResult> {
    const valid = validateEido(eido);
    if (!valid.ok) {
      return {
        hubMessageId: crypto.randomUUID(),
        incidentId: eido.incident?.IncidentId ?? "unknown",
        sourceAgencyId: eido.header?.SenderAgencyId ?? "unknown",
        targets: [],
        decisions: [],
      };
    }
    const sender = await this.registry.getAgency(valid.value.header.SenderAgencyId);
    if (!sender) {
      return {
        hubMessageId: crypto.randomUUID(),
        incidentId: valid.value.incident.IncidentId,
        sourceAgencyId: valid.value.header.SenderAgencyId,
        targets: [],
        decisions: [],
      };
    }
    const agencies = await this.registry.listAgencies();
    const evaluation = await this.rules.evaluate(valid.value, sender.agencyId, agencies);
    const targets = evaluation.decisions
      .map((d) => agencies.find((a) => a.agencyId === d.targetAgencyId))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
    const hubIncidentId = valid.value.incident.HubIncidentId ?? crypto.randomUUID();
    valid.value.incident.HubIncidentId = hubIncidentId;
    await this.tracker.link(hubIncidentId, sender.agencyId, valid.value.incident.IncidentId, valid.value);
    const fan = await this.fanOut(valid.value, targets, "NEW_INCIDENT");
    return {
      hubMessageId: valid.value.header.MessageId,
      incidentId: valid.value.incident.IncidentId,
      sourceAgencyId: sender.agencyId,
      targets: fan.targets,
      decisions: evaluation.decisions,
    };
  }

  async routeIncidentUpdate(eido: EidoEnvelope, _diff: EidoDiff): Promise<RoutingResult> {
    return this.routeNewIncident({
      ...eido,
      header: { ...eido.header, MessageType: "INCIDENT_UPDATE" },
    });
  }

  async routeUnitStatusUpdate(update: EidoUnitStatusUpdate): Promise<RoutingResult> {
    const targets: RoutingTargetResult[] = [];
    for (const [agencyId, adapter] of this.adapters) {
      if (agencyId === update.AgencyId) continue;
      try {
        await adapter.receiveDispatchConfirmation?.({
          header: update.header,
          TransferRequestMessageId: update.header.MessageId,
          IncidentId: update.IncidentId ?? "",
          ConfirmingAgencyId: update.AgencyId,
          ConfirmedAt: update.Timestamp,
          AssignedUnits: [],
        });
        targets.push({ agencyId, ok: true });
      } catch (error) {
        targets.push({ agencyId, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return {
      hubMessageId: update.header.MessageId,
      incidentId: update.IncidentId ?? "",
      sourceAgencyId: update.AgencyId,
      targets,
      decisions: [],
    };
  }

  async routeTransferRequest(request: EidoTransferRequest): Promise<RoutingResult> {
    const adapter = this.adapters.get(request.transfer.TargetAgencyId);
    const started = Date.now();
    if (!adapter) {
      return {
        hubMessageId: request.header.MessageId,
        incidentId: request.incident.IncidentId,
        sourceAgencyId: request.header.SenderAgencyId,
        targets: [{ agencyId: request.transfer.TargetAgencyId, ok: false, error: "adapter not registered" }],
        decisions: [],
      };
    }
    try {
      if (adapter.receiveTransferRequest) {
        await adapter.receiveTransferRequest(request);
      } else {
        await adapter.createIncident({ eido: { header: request.header, incident: request.incident }, autoDispatch: request.transfer.AutoDispatch });
      }
      await this.audit.write({
        hubMessageId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        messageType: "TRANSFER_REQUEST",
        sourceAgencyId: request.header.SenderAgencyId,
        targetAgencyId: request.transfer.TargetAgencyId,
        eidoMessageId: request.header.MessageId,
        incidentId: request.incident.IncidentId,
        status: "SUCCESS",
        durationMs: Date.now() - started,
      });
      return {
        hubMessageId: request.header.MessageId,
        incidentId: request.incident.IncidentId,
        sourceAgencyId: request.header.SenderAgencyId,
        targets: [{ agencyId: request.transfer.TargetAgencyId, ok: true }],
        decisions: [],
      };
    } catch (error) {
      this.queue.enqueue(request.transfer.TargetAgencyId, request);
      return {
        hubMessageId: request.header.MessageId,
        incidentId: request.incident.IncidentId,
        sourceAgencyId: request.header.SenderAgencyId,
        targets: [
          {
            agencyId: request.transfer.TargetAgencyId,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
        ],
        decisions: [],
      };
    }
  }

  async routeDispatchConfirmation(conf: EidoDispatchConfirmation): Promise<RoutingResult> {
    const targetId = String(conf.header.RecipientAgencyId === "*" ? conf.header.SenderAgencyId : conf.header.RecipientAgencyId);
    const adapter = this.adapters.get(targetId);
    if (!adapter) {
      return {
        hubMessageId: conf.header.MessageId,
        incidentId: conf.IncidentId,
        sourceAgencyId: conf.ConfirmingAgencyId,
        targets: [{ agencyId: targetId, ok: false, error: "adapter not registered" }],
        decisions: [],
      };
    }
    try {
      await adapter.receiveDispatchConfirmation(conf);
      return {
        hubMessageId: conf.header.MessageId,
        incidentId: conf.IncidentId,
        sourceAgencyId: conf.ConfirmingAgencyId,
        targets: [{ agencyId: targetId, ok: true }],
        decisions: [],
      };
    } catch (error) {
      return {
        hubMessageId: conf.header.MessageId,
        incidentId: conf.IncidentId,
        sourceAgencyId: conf.ConfirmingAgencyId,
        targets: [{ agencyId: targetId, ok: false, error: error instanceof Error ? error.message : String(error) }],
        decisions: [],
      };
    }
  }

  private async fanOut(
    eido: EidoEnvelope,
    targets: { agencyId: string; agencyType: string }[],
    messageType: C2CMessageType,
  ): Promise<FanOutResult> {
    const results: RoutingTargetResult[] = [];
    for (const target of targets) {
      const adapter = this.adapters.get(target.agencyId);
      const started = Date.now();
      if (!adapter) {
        results.push({ agencyId: target.agencyId, ok: false, error: "adapter not registered" });
        continue;
      }
      const redacted = this.redaction.redact(
        eido,
        target.agencyType === "FIRE" || target.agencyType === "EMS" || target.agencyType === "LAW_ENFORCEMENT" || target.agencyType === "COMBINED"
          ? target.agencyType
          : "FIRE",
      );
      try {
        const created = await adapter.createIncident({
          eido: redacted,
          autoDispatch: false,
        });
        results.push({ agencyId: target.agencyId, ok: true, nativeIncidentId: created.nativeIncidentId });
        if (eido.incident.HubIncidentId) {
          await this.tracker.link(eido.incident.HubIncidentId, target.agencyId, created.nativeIncidentId, redacted);
        }
        await this.audit.write({
          hubMessageId: `${eido.header.MessageId}:${target.agencyId}`,
          timestamp: new Date().toISOString(),
          messageType,
          sourceAgencyId: eido.header.SenderAgencyId,
          targetAgencyId: target.agencyId,
          eidoMessageId: eido.header.MessageId,
          incidentId: eido.incident.IncidentId,
          status: "SUCCESS",
          durationMs: Date.now() - started,
        });
      } catch (error) {
        this.queue.enqueue(target.agencyId, { eido: redacted, messageType });
        const message = error instanceof Error ? error.message : String(error);
        results.push({ agencyId: target.agencyId, ok: false, error: message });
        await this.audit.write({
          hubMessageId: `${eido.header.MessageId}:${target.agencyId}`,
          timestamp: new Date().toISOString(),
          messageType,
          sourceAgencyId: eido.header.SenderAgencyId,
          targetAgencyId: target.agencyId,
          eidoMessageId: eido.header.MessageId,
          incidentId: eido.incident.IncidentId,
          status: "FAILURE",
          durationMs: Date.now() - started,
          errorMessage: message,
        });
      }
    }
    void this.health;
    return { targets: results };
  }
}
