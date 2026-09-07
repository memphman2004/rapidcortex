import { create } from 'zustand';
import {
  createCode as apiCreateCode,
  deleteCode as apiDeleteCode,
  isCodesApiError,
  listCodes,
  logNfcWrite as apiLogNfcWrite,
  updateCode as apiUpdateCode,
  type LogNfcWritePayload,
} from '../services/api/codes';
import type {
  CodeVertical,
  CreateCodePayload,
  NFCWriteEvent,
  RCCode,
} from '../types/mobile';

export type CodesStatusFilter = 'all' | 'active' | 'inactive' | 'nfcWritten' | 'notWritten';
export type CodesVerticalFilter = CodeVertical | 'all';

interface CodesStoreState {
  codes: RCCode[];
  isLoading: boolean;
  error: string | null;
  agencyId: string | null;

  search: string;
  statusFilter: CodesStatusFilter;
  verticalFilter: CodesVerticalFilter;

  fetchCodes: (agencyId: string) => Promise<void>;
  createNewCode: (payload: CreateCodePayload) => Promise<RCCode>;
  patchCode: (codeId: string, patch: Partial<RCCode>) => Promise<RCCode>;
  removeCode: (codeId: string) => Promise<void>;
  recordNfcWrite: (
    codeId: string,
    payload: LogNfcWritePayload,
  ) => Promise<NFCWriteEvent>;

  setSearch: (value: string) => void;
  setStatusFilter: (value: CodesStatusFilter) => void;
  setVerticalFilter: (value: CodesVerticalFilter) => void;

  getFilteredCodes: () => RCCode[];
  getCodeById: (codeId: string) => RCCode | undefined;
  clearError: () => void;
}

function upsertCode(codes: RCCode[], next: RCCode): RCCode[] {
  const index = codes.findIndex((code) => code.codeId === next.codeId);
  if (index === -1) return [next, ...codes];
  const copy = [...codes];
  copy[index] = next;
  return copy;
}

export const useCodesStore = create<CodesStoreState>((set, get) => ({
  codes: [],
  isLoading: false,
  error: null,
  agencyId: null,

  search: '',
  statusFilter: 'all',
  verticalFilter: 'all',

  fetchCodes: async (agencyId) => {
    set({ isLoading: true, error: null, agencyId });
    try {
      const codes = await listCodes({ agencyId });
      set({ codes, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: isCodesApiError(error) ?? 'Unable to load codes' });
    }
  },

  createNewCode: async (payload) => {
    set({ error: null });
    try {
      const code = await apiCreateCode(payload);
      set((state) => ({ codes: upsertCode(state.codes, code) }));
      return code;
    } catch (error) {
      const message = isCodesApiError(error) ?? 'Unable to create code';
      set({ error: message });
      throw new Error(message);
    }
  },

  patchCode: async (codeId, patch) => {
    try {
      const code = await apiUpdateCode(codeId, patch);
      set((state) => ({ codes: upsertCode(state.codes, code) }));
      return code;
    } catch (error) {
      const message = isCodesApiError(error) ?? 'Unable to update code';
      set({ error: message });
      throw new Error(message);
    }
  },

  removeCode: async (codeId) => {
    try {
      await apiDeleteCode(codeId);
      set((state) => ({ codes: state.codes.filter((code) => code.codeId !== codeId) }));
    } catch (error) {
      const message = isCodesApiError(error) ?? 'Unable to delete code';
      set({ error: message });
      throw new Error(message);
    }
  },

  recordNfcWrite: async (codeId, payload) => {
    try {
      const event = await apiLogNfcWrite(codeId, payload);
      set((state) => ({
        codes: state.codes.map((code) =>
          code.codeId === codeId
            ? {
                ...code,
                nfcWriteLog: [event, ...code.nfcWriteLog],
                metrics: {
                  ...code.metrics,
                  nfcTaps: code.metrics.nfcTaps,
                  lastNfcTap: event.writtenAt,
                },
              }
            : code,
        ),
      }));
      return event;
    } catch (error) {
      const message = isCodesApiError(error) ?? 'Unable to record NFC write';
      set({ error: message });
      throw new Error(message);
    }
  },

  setSearch: (value) => set({ search: value }),
  setStatusFilter: (value) => set({ statusFilter: value }),
  setVerticalFilter: (value) => set({ verticalFilter: value }),

  getFilteredCodes: () => {
    const { codes, search, statusFilter, verticalFilter } = get();
    const query = search.trim().toLowerCase();

    return codes.filter((code) => {
      if (verticalFilter !== 'all' && code.vertical !== verticalFilter) return false;

      if (statusFilter === 'active' && code.status !== 'active') return false;
      if (statusFilter === 'inactive' && code.status !== 'inactive') return false;
      if (statusFilter === 'nfcWritten' && code.nfcWriteLog.length === 0) return false;
      if (statusFilter === 'notWritten' && code.nfcWriteLog.length > 0) return false;

      if (!query) return true;
      return (
        code.name.toLowerCase().includes(query) || code.zone.toLowerCase().includes(query)
      );
    });
  },

  getCodeById: (codeId) => get().codes.find((code) => code.codeId === codeId),

  clearError: () => set({ error: null }),
}));
