import { get, patch } from './client';

export type NfcCardStatus = 'unassigned' | 'assigned' | 'programmed' | 'verified' | 'revoked';

export type BusinessCardNfcCard = {
  cardId: string;
  tagType: string;
  status: NfcCardStatus | string;
  permanentUrl: string;
  version: number;
  assignedProfileId?: string;
  programmedAt?: number;
  verifiedAt?: number;
};

export type BusinessCardProfileSummary = {
  profileId: string;
  displayName: string;
  title?: string;
  status?: string;
};

type ErrorBody = { error?: string; message?: string };

function messageFromError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: ErrorBody; status?: number } }).response;
    const data = response?.data;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (response?.status === 403) return 'Business card NFC requires an RC admin account.';
    if (response?.status === 401) return 'Sign in again to program business card tags.';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function listNfcCards(): Promise<BusinessCardNfcCard[]> {
  try {
    const response = await get<{ items: BusinessCardNfcCard[] }>('/api/admin/nfc-cards');
    return response.data.items ?? [];
  } catch (error) {
    throw new Error(messageFromError(error, 'Could not load NFC cards.'));
  }
}

export async function getNfcCard(cardId: string): Promise<BusinessCardNfcCard> {
  try {
    const response = await get<BusinessCardNfcCard>(`/api/admin/nfc-cards/${encodeURIComponent(cardId)}`);
    return response.data;
  } catch (error) {
    throw new Error(messageFromError(error, 'Could not load that NFC card.'));
  }
}

export async function listBusinessCardProfiles(): Promise<BusinessCardProfileSummary[]> {
  try {
    const response = await get<{ items: BusinessCardProfileSummary[] }>('/api/admin/business-cards');
    return response.data.items ?? [];
  } catch (error) {
    throw new Error(messageFromError(error, 'Could not load business card profiles.'));
  }
}

export async function setNfcCardStatus(
  cardId: string,
  status: 'programmed' | 'verified',
  version: number,
): Promise<BusinessCardNfcCard> {
  try {
    const response = await patch<BusinessCardNfcCard>(
      `/api/admin/nfc-cards/${encodeURIComponent(cardId)}/status`,
      { status, version },
    );
    return response.data;
  } catch (error) {
    throw new Error(messageFromError(error, 'Could not update NFC card status.'));
  }
}
