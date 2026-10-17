import { randomUUID } from "node:crypto";
import type { EtaNotificationRecord, EtaNotificationTrigger } from "rapid-cortex-shared";
import { preArrivalSessionStore } from "../session-store.js";

export async function recordEtaNotification(params: {
  agencyId: string;
  sessionToken: string;
  trigger: EtaNotificationTrigger;
  etaMinutes: number | null;
  messageBody: string;
  unitId?: string;
}): Promise<EtaNotificationRecord> {
  const session = await preArrivalSessionStore.getForAgency(params.sessionToken, params.agencyId);
  if (!session) throw new Error("NOT_FOUND");

  const now = new Date().toISOString();
  const record: EtaNotificationRecord = {
    notificationId: randomUUID(),
    trigger: params.trigger,
    etaMinutes: params.etaMinutes,
    unitId: params.unitId,
    sentAt: now,
    messageBody: params.messageBody,
    acknowledged: false,
  };

  const etaNotifications = [...(session.etaNotifications ?? []), record].slice(-50);
  const updates: Record<string, unknown> = {
    etaNotifications,
    lastEtaNotifiedAt: now,
    updatedAt: now,
  };
  if (params.etaMinutes !== null) {
    updates.lastKnownEtaMinutes = params.etaMinutes;
    updates.responderStatus = params.etaMinutes <= 1 ? "responding" : "responding";
  }
  if (params.trigger === "on_scene" || params.etaMinutes === null) {
    updates.onSceneAt = now;
    updates.responderStatus = "arrived";
    updates.lastKnownEtaMinutes = 0;
  }

  await preArrivalSessionStore.updateFields(params.agencyId, params.sessionToken, updates);
  return record;
}
