import { z } from "zod";

export type TimelineEventKind =
  | "call_received"
  | "transcription_started"
  | "ai_analysis_created"
  | "unit_dispatched"
  | "unit_status_changed"
  | "cad_synced"
  | "supervisor_joined"
  | "translation_activated"
  | "media_requested"
  | "media_received"
  | "manual_override"
  | "dispatcher_note"
  | "hospital_prealert_sent"
  | "hospital_prealert_acknowledged"
  | "hospital_prealert_failed"
  | "hospital_prealert_cancelled"
  | "call_ended"
  | "incident_closed"
  | "sms_received"
  | "report_submitted"
  | "auto_reply_sent"
  | "location_received"
  | "chat_message_received";

export type TimelineEventSource = "system" | "dispatcher" | "supervisor" | "cad" | "ai";

export interface TimelineEvent {
  eventId: string;
  incidentId: string;
  agencyId: string;
  kind: TimelineEventKind;
  actorId?: string;
  actorRole?: string;
  payload: Record<string, unknown>;
  timestamp: string;
  source: TimelineEventSource;
}

export const postIncidentTimelineNoteBodySchema = z.object({
  content: z.string().min(1).max(8000),
});
export type PostIncidentTimelineNoteBody = z.infer<typeof postIncidentTimelineNoteBodySchema>;

export type IncidentTimelineListResponse = { items: TimelineEvent[] };
export type IncidentTimelineExportResponse = {
  incidentId: string;
  agencyId: string;
  exportedAt: string;
  events: TimelineEvent[];
};
