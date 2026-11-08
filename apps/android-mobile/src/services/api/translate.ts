import { get, post } from './client';

export type TranslateVertical = 'campus' | 'venue' | 'hospital' | 'law_enforcement';

export interface TranslateLanguage {
  code: string;
  label: string;
}

export interface TranslateSession {
  sessionId: string;
  agencyId: string;
  status: string;
  subjectLanguage: string;
  primaryLanguage: string;
  segmentCount: number;
  startedAt: string;
  endedAt?: string;
  vertical: TranslateVertical;
  sessionSummary?: string;
}

export interface TranslateSegment {
  segmentId: string;
  speaker: string;
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: string;
  isFinal: boolean;
}

export interface TranslateSessionCreateBody {
  subjectLanguage?: string;
  /** Required for RC operators without a home tenant JWT agency. */
  agencyId?: string;
  vertical: TranslateVertical;
  campusContext?: { campusCode: string; campusIncidentId?: string };
  venueContext?: { venueCode: string; venueIncidentId?: string };
}

export async function fetchTranslateLanguages(): Promise<{
  languages: TranslateLanguage[];
}> {
  const res = await get<{ languages: TranslateLanguage[] }>('/api/translate/languages');
  return res.data;
}

export async function createTranslateSession(
  body: TranslateSessionCreateBody,
): Promise<{ session: TranslateSession; wsEndpoint?: string }> {
  const res = await post<{ session: TranslateSession; wsEndpoint?: string }>(
    '/api/translate/sessions',
    body,
  );
  return res.data;
}

export async function listTranslateSegments(
  sessionId: string,
): Promise<{ items: TranslateSegment[] }> {
  const res = await get<{ items: TranslateSegment[] }>(
    `/api/translate/sessions/${encodeURIComponent(sessionId)}/segments`,
  );
  return res.data;
}

export async function getTranslateSession(
  sessionId: string,
): Promise<{ session: TranslateSession }> {
  const res = await get<{ session: TranslateSession }>(
    `/api/translate/sessions/${encodeURIComponent(sessionId)}`,
  );
  return res.data;
}

export async function closeTranslateSession(
  sessionId: string,
  opts?: { writebackNote?: boolean; notes?: string; agencyId?: string },
): Promise<{
  session: TranslateSession;
  writebackQueued?: boolean;
  assistanceEncounterId?: string;
}> {
  const agencyQ = opts?.agencyId
    ? `?agencyId=${encodeURIComponent(opts.agencyId)}`
    : '';
  const { agencyId: _agencyId, ...body } = opts ?? {};
  const res = await post<{
    session: TranslateSession;
    writebackQueued?: boolean;
    assistanceEncounterId?: string;
  }>(`/api/translate/sessions/${encodeURIComponent(sessionId)}/close${agencyQ}`, body);
  return res.data;
}

export async function getTranslateWsToken(
  sessionId: string,
  role: 'officer' | 'monitor' = 'officer',
  agencyId?: string,
): Promise<{ token: string; wsEndpoint: string; expiresIn: number }> {
  const params = new URLSearchParams({ role });
  if (agencyId) params.set('agencyId', agencyId);
  const res = await get<{ token: string; wsEndpoint: string; expiresIn: number }>(
    `/api/translate/sessions/${encodeURIComponent(sessionId)}/ws-token?${params.toString()}`,
  );
  return res.data;
}
