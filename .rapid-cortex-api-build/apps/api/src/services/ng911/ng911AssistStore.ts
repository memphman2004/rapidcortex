import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  AdditionalDataPackage,
  ClinicianConsult,
  CrisisAgencyConfig,
  CrisisAssessment,
  CrisisDestination,
  CrisisProtocol,
  DiversionAgencyConfig,
  DiversionSession,
  DiversionWorkflow,
  EidoDocument,
} from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

function table(): string {
  const t = env.ng911AssistTable;
  if (!t) throw new Error("NG911_ASSIST_TABLE is not configured");
  return t;
}

const sk = {
  config: () => "CONFIG#diversion",
  workflow: (id: string) => `WORKFLOW#${id}`,
  session: (id: string) => `SESSION#${id}`,
  additional: (incidentId: string) => `AD#${incidentId}`,
  eido: (incidentId: string) => `EIDO#${incidentId}`,
  crisisConfig: () => "CONFIG#crisis",
  crisisProtocol: (id: string) => `CRISIS_PROTOCOL#${id}`,
  crisisDestination: (id: string) => `DESTINATION#${id}`,
  crisisAssessment: (id: string) => `CRISIS_ASSESS#${id}`,
  clinicianConsult: (id: string) => `CLINICIAN_Q#${id}`,
  partnerHandoff: (id: string) => `EIDO_HANDOFF#${id}`,
};

export class Ng911AssistStore {
  async getConfig(agencyId: string): Promise<DiversionAgencyConfig | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.config() } }),
    );
    return (out.Item as DiversionAgencyConfig | undefined) ?? null;
  }

  async putConfig(config: DiversionAgencyConfig): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...config, sk: sk.config(), entityType: "diversion_config" },
      }),
    );
  }

  async listWorkflows(agencyId: string): Promise<DiversionWorkflow[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "WORKFLOW#" },
      }),
    );
    return ((out.Items as DiversionWorkflow[]) ?? []).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  }

  async getWorkflow(agencyId: string, workflowId: string): Promise<DiversionWorkflow | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.workflow(workflowId) },
      }),
    );
    return (out.Item as DiversionWorkflow | undefined) ?? null;
  }

  async putWorkflow(workflow: DiversionWorkflow): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...workflow,
          sk: sk.workflow(workflow.workflowId),
          entityType: "diversion_workflow",
        },
      }),
    );
  }

  async deleteWorkflow(agencyId: string, workflowId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.workflow(workflowId) },
      }),
    );
  }

  async putSession(session: DiversionSession): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...session,
          sk: sk.session(session.sessionId),
          entityType: "diversion_session",
          gsi1pk: `SESSION#${session.status}`,
          gsi1sk: session.createdAt,
        },
      }),
    );
  }

  async getSession(agencyId: string, sessionId: string): Promise<DiversionSession | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.session(sessionId) },
      }),
    );
    return (out.Item as DiversionSession | undefined) ?? null;
  }

  async listSessions(agencyId: string, limit = 100): Promise<DiversionSession[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "SESSION#" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items as DiversionSession[]) ?? [];
  }

  async putAdditionalData(pkg: AdditionalDataPackage): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...pkg,
          sk: sk.additional(pkg.incidentId),
          entityType: "additional_data",
        },
      }),
    );
  }

  async getAdditionalData(
    agencyId: string,
    incidentId: string,
  ): Promise<AdditionalDataPackage | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.additional(incidentId) },
      }),
    );
    return (out.Item as AdditionalDataPackage | undefined) ?? null;
  }

  async putEido(doc: EidoDocument): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...doc,
          sk: sk.eido(doc.incidentId),
          entityType: "eido",
        },
      }),
    );
  }

  async getEido(agencyId: string, incidentId: string): Promise<EidoDocument | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.eido(incidentId) },
      }),
    );
    return (out.Item as EidoDocument | undefined) ?? null;
  }

  async touchSession(
    agencyId: string,
    sessionId: string,
    patch: Partial<DiversionSession>,
  ): Promise<void> {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const parts: string[] = [];
    let i = 0;
    for (const [k, v] of Object.entries(patch)) {
      if (k === "sessionId" || k === "agencyId") continue;
      const nk = `#k${i}`;
      const nv = `:v${i}`;
      names[nk] = k;
      values[nv] = v;
      parts.push(`${nk} = ${nv}`);
      i += 1;
    }
    if (!parts.length) return;
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.session(sessionId) },
        UpdateExpression: `SET ${parts.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }

  // ── Crisis diversion ────────────────────────────────────────────────────

  async getCrisisConfig(agencyId: string): Promise<CrisisAgencyConfig | null> {
    const out = await ddb.send(
      new GetCommand({ TableName: table(), Key: { agencyId, sk: sk.crisisConfig() } }),
    );
    return (out.Item as CrisisAgencyConfig | undefined) ?? null;
  }

  async putCrisisConfig(config: CrisisAgencyConfig): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...config, sk: sk.crisisConfig(), entityType: "crisis_config" },
      }),
    );
  }

  async listCrisisProtocols(agencyId: string): Promise<CrisisProtocol[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "CRISIS_PROTOCOL#" },
      }),
    );
    return ((out.Items as CrisisProtocol[]) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async getCrisisProtocol(agencyId: string, protocolId: string): Promise<CrisisProtocol | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.crisisProtocol(protocolId) },
      }),
    );
    return (out.Item as CrisisProtocol | undefined) ?? null;
  }

  async putCrisisProtocol(protocol: CrisisProtocol): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...protocol,
          sk: sk.crisisProtocol(protocol.protocolId),
          entityType: "crisis_protocol",
        },
      }),
    );
  }

  async deleteCrisisProtocol(agencyId: string, protocolId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.crisisProtocol(protocolId) },
      }),
    );
  }

  async listCrisisDestinations(agencyId: string): Promise<CrisisDestination[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "DESTINATION#" },
      }),
    );
    return ((out.Items as CrisisDestination[]) ?? []).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  }

  async getCrisisDestination(
    agencyId: string,
    destinationId: string,
  ): Promise<CrisisDestination | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.crisisDestination(destinationId) },
      }),
    );
    return (out.Item as CrisisDestination | undefined) ?? null;
  }

  async putCrisisDestination(dest: CrisisDestination): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...dest,
          sk: sk.crisisDestination(dest.destinationId),
          entityType: "crisis_destination",
        },
      }),
    );
  }

  async deleteCrisisDestination(agencyId: string, destinationId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.crisisDestination(destinationId) },
      }),
    );
  }

  async putCrisisAssessment(assessment: CrisisAssessment): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...assessment,
          sk: sk.crisisAssessment(assessment.assessmentId),
          entityType: "crisis_assessment",
          gsi1pk: `CRISIS_ASSESS#${assessment.status}`,
          gsi1sk: assessment.createdAt,
        },
      }),
    );
  }

  async getCrisisAssessment(
    agencyId: string,
    assessmentId: string,
  ): Promise<CrisisAssessment | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.crisisAssessment(assessmentId) },
      }),
    );
    return (out.Item as CrisisAssessment | undefined) ?? null;
  }

  async listCrisisAssessments(agencyId: string, limit = 100): Promise<CrisisAssessment[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "CRISIS_ASSESS#" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items as CrisisAssessment[]) ?? [];
  }

  async putClinicianConsult(consult: ClinicianConsult): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...consult,
          sk: sk.clinicianConsult(consult.consultId),
          entityType: "clinician_consult",
          gsi1pk: `CLINICIAN#${consult.status}`,
          gsi1sk: consult.createdAt,
        },
      }),
    );
  }

  async getClinicianConsult(agencyId: string, consultId: string): Promise<ClinicianConsult | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId, sk: sk.clinicianConsult(consultId) },
      }),
    );
    return (out.Item as ClinicianConsult | undefined) ?? null;
  }

  async listClinicianConsults(agencyId: string, limit = 100): Promise<ClinicianConsult[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "CLINICIAN_Q#" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items as ClinicianConsult[]) ?? [];
  }

  async putPartnerHandoff(agencyId: string, item: Record<string, unknown>): Promise<void> {
    const handoffId = String(item.handoffId ?? "");
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...item,
          agencyId,
          sk: sk.partnerHandoff(handoffId),
          entityType: "eido_partner_handoff",
        },
      }),
    );
  }
}

export const ng911AssistStore = new Ng911AssistStore();
