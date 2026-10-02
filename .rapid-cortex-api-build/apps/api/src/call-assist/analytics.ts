import {
  computeCallAssistAnalytics,
  type CallAssistAnalyticsFilter,
  type CallAssistAnalyticsSession,
} from "rapid-cortex-shared";
import { callAssistStore } from "./store.js";

export async function buildCallAssistAnalyticsDashboard(agencyId: string, filter: CallAssistAnalyticsFilter) {
  const [open, done, surveys] = await Promise.all([
    callAssistStore.listSessions(agencyId, true, 400),
    callAssistStore.listSessions(agencyId, false, 400),
    callAssistStore.listSurveys(agencyId, 400),
  ]);
  const scores = new Map(surveys.map((s) => [s.sessionId, s.score]));
  const toRow = (s: (typeof open)[number]): CallAssistAnalyticsSession => ({
    sessionId: s.sessionId,
    state: s.state,
    createdAt: s.createdAt,
    completedAt: s.completedAt,
    language: s.language,
    shiftLabel: s.shiftLabel,
    dispatcherId: s.dispatcherId,
    zoneName: s.intake?.zoneName,
    locationText: s.intake?.locationText,
    routingDestinationType: s.routing?.destinationType,
    humanTakeover: s.humanTakeover,
    falseTransferSuspected: s.falseTransferSuspected,
    smsStatus: s.smsSelfService?.status,
    onlineReportingEligible: s.triage?.onlineReportingEligible,
    surveyScore: scores.get(s.sessionId),
  });
  const sessions = [...open, ...done].filter((s) => s.agencyId === agencyId).map(toRow);
  return computeCallAssistAnalytics({
    sessions,
    openSessions: open.filter((s) => s.agencyId === agencyId).map(toRow),
    filter,
  });
}
