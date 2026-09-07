import axios from 'axios';
import { del, get, patch, post } from './client';
import type {
  ApiEnvelope,
  CreateCodePayload,
  NFCWriteEvent,
  RCCode,
} from '../../types/mobile';

function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  const envelope = response.data;
  if (!envelope.success) {
    throw new Error(envelope.error ?? 'Request failed');
  }
  if (envelope.data === undefined) {
    throw new Error('Response missing data payload');
  }
  return envelope.data;
}

export interface ListCodesParams {
  agencyId: string;
  vertical?: string;
  search?: string;
  status?: string;
}

export async function listCodes(params: ListCodesParams): Promise<RCCode[]> {
  const response = await get<ApiEnvelope<{ codes: RCCode[] }>>('/api/codes', {
    params,
  });
  const data = unwrap(response);
  return data.codes;
}

export async function createCode(payload: CreateCodePayload): Promise<RCCode> {
  const response = await post<ApiEnvelope<{ code: RCCode }>>('/api/codes', payload);
  const data = unwrap(response);
  return data.code;
}

export async function getCode(codeId: string): Promise<RCCode> {
  const response = await get<ApiEnvelope<{ code: RCCode }>>(`/api/codes/${codeId}`);
  const data = unwrap(response);
  return data.code;
}

export async function updateCode(
  codeId: string,
  patchBody: Partial<RCCode>,
): Promise<RCCode> {
  const response = await patch<ApiEnvelope<{ code: RCCode }>>(
    `/api/codes/${codeId}`,
    patchBody,
  );
  const data = unwrap(response);
  return data.code;
}

export async function deleteCode(codeId: string): Promise<void> {
  const response = await del<ApiEnvelope<{ success: true }>>(`/api/codes/${codeId}`);
  unwrap(response);
}

export interface LogNfcWritePayload {
  writtenBy: string;
  devicePlatform: 'ios' | 'android';
  writeMethod: 'native_nfc';
  bytesWritten: number;
  tagType?: string;
}

export async function logNfcWrite(
  codeId: string,
  payload: LogNfcWritePayload,
): Promise<NFCWriteEvent> {
  const response = await post<ApiEnvelope<{ event: NFCWriteEvent }>>(
    `/api/codes/${codeId}/nfc-write`,
    payload,
  );
  const data = unwrap(response);
  return data.event;
}

export function isCodesApiError(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : null;
  }
  const envelope = error.response?.data as ApiEnvelope<unknown> | undefined;
  return envelope?.error ?? error.message;
}
