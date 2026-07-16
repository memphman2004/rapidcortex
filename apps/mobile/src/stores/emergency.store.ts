import { create } from 'zustand';
import {
  cancelGuardianEvent,
  getGuardianEvent,
  isGuardianApiError,
  type GuardianCancelSource,
} from '../services/api/guardian';
import type { GuardianEmergencyEvent } from '../types/mobile';

function computeRemainingSeconds(event: GuardianEmergencyEvent | null): number {
  if (!event) return 0;
  const expiresAt = new Date(event.cancelWindowExpiresAt).getTime();
  const remainingMs = expiresAt - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

interface EmergencyStoreState {
  event: GuardianEmergencyEvent | null;
  isLoading: boolean;
  error: string | null;
  remainingSeconds: number;
  isCancelling: boolean;
  pollHandle: ReturnType<typeof setInterval> | null;

  loadEvent: (eventId: string) => Promise<void>;
  startTicking: (eventId: string) => void;
  stopTicking: () => void;
  cancelEvent: (eventId: string, cancelledBy: GuardianCancelSource) => Promise<void>;
  reset: () => void;
}

export const useEmergencyStore = create<EmergencyStoreState>((set, get) => ({
  event: null,
  isLoading: false,
  error: null,
  remainingSeconds: 0,
  isCancelling: false,
  pollHandle: null,

  loadEvent: async (eventId) => {
    set({ isLoading: true, error: null });
    try {
      const event = await getGuardianEvent(eventId);
      set({
        event,
        isLoading: false,
        remainingSeconds: computeRemainingSeconds(event),
      });
    } catch (error) {
      set({
        isLoading: false,
        error: isGuardianApiError(error) ?? 'Unable to load emergency event',
      });
    }
  },

  startTicking: (eventId) => {
    get().stopTicking();

    const handle = setInterval(() => {
      const { event } = get();
      if (!event) return;

      const remaining = computeRemainingSeconds(event);
      set({ remainingSeconds: remaining });

      if (remaining <= 0 && event.status === 'COUNTDOWN_ACTIVE') {
        void getGuardianEvent(eventId)
          .then((refreshed) => {
            set({ event: refreshed, remainingSeconds: computeRemainingSeconds(refreshed) });
            if (refreshed.status !== 'COUNTDOWN_ACTIVE') {
              get().stopTicking();
            }
          })
          .catch(() => undefined);
      }
    }, 1000);

    set({ pollHandle: handle });
  },

  stopTicking: () => {
    const { pollHandle } = get();
    if (pollHandle) {
      clearInterval(pollHandle);
    }
    set({ pollHandle: null });
  },

  cancelEvent: async (eventId, cancelledBy) => {
    set({ isCancelling: true, error: null });
    try {
      const event = await cancelGuardianEvent(eventId, cancelledBy);
      get().stopTicking();
      set({ event, isCancelling: false, remainingSeconds: 0 });
    } catch (error) {
      set({
        isCancelling: false,
        error: isGuardianApiError(error) ?? 'Unable to cancel emergency alert',
      });
      throw error;
    }
  },

  reset: () => {
    get().stopTicking();
    set({
      event: null,
      isLoading: false,
      error: null,
      remainingSeconds: 0,
      isCancelling: false,
    });
  },
}));
