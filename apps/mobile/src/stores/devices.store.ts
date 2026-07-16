import { create } from 'zustand';
import {
  createGeofence as apiCreateGeofence,
  deleteDevice as apiDeleteDevice,
  deleteGeofence as apiDeleteGeofence,
  getDevice,
  getDeviceHistory,
  getDeviceLocation,
  isDevicesApiError,
  listDevices,
  listGeofences,
  registerDevice,
  saveEmergencyContacts,
  setLostMode as apiSetLostMode,
  setRcCoreConsent as apiSetRcCoreConsent,
  updateDevice as apiUpdateDevice,
  type LocationHistoryParams,
} from '../services/api/devices';
import type {
  CreateGeofencePayload,
  EmergencyContact,
  LocationSnapshot,
  RegisterDevicePayload,
  SSDevice,
  SSGeofence,
  SSLocationEvent,
} from '../types/mobile';

interface DevicesStoreState {
  devices: SSDevice[];
  isLoading: boolean;
  error: string | null;

  locations: Record<string, LocationSnapshot>;
  locationsLoading: Record<string, boolean>;

  history: Record<string, SSLocationEvent[]>;
  historyLoading: Record<string, boolean>;

  geofences: Record<string, SSGeofence[]>;
  geofencesLoading: Record<string, boolean>;

  emergencyContacts: EmergencyContact[];
  contactsLoading: boolean;
  contactsError: string | null;

  fetchDevices: () => Promise<void>;
  addDevice: (payload: RegisterDevicePayload) => Promise<SSDevice>;
  refreshDevice: (deviceId: string) => Promise<void>;
  patchDevice: (deviceId: string, patch: Partial<SSDevice>) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  toggleLostMode: (deviceId: string, active: boolean) => Promise<void>;
  toggleRcCoreConsent: (deviceId: string, consent: boolean) => Promise<void>;

  fetchDeviceLocation: (deviceId: string) => Promise<void>;
  fetchDeviceHistory: (
    deviceId: string,
    params?: LocationHistoryParams,
  ) => Promise<void>;

  fetchGeofences: (deviceId: string) => Promise<void>;
  addGeofence: (
    deviceId: string,
    payload: CreateGeofencePayload,
  ) => Promise<SSGeofence>;
  removeGeofence: (deviceId: string, geofenceId: string) => Promise<void>;

  setEmergencyContacts: (contacts: EmergencyContact[]) => Promise<void>;

  getDeviceById: (deviceId: string) => SSDevice | undefined;
  clearError: () => void;
}

function upsertDevice(devices: SSDevice[], next: SSDevice): SSDevice[] {
  const index = devices.findIndex((device) => device.deviceId === next.deviceId);
  if (index === -1) return [...devices, next];
  const copy = [...devices];
  copy[index] = next;
  return copy;
}

export const useDevicesStore = create<DevicesStoreState>((set, get) => ({
  devices: [],
  isLoading: false,
  error: null,

  locations: {},
  locationsLoading: {},

  history: {},
  historyLoading: {},

  geofences: {},
  geofencesLoading: {},

  emergencyContacts: [],
  contactsLoading: false,
  contactsError: null,

  fetchDevices: async () => {
    set({ isLoading: true, error: null });
    try {
      const devices = await listDevices();
      set({ devices, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: isDevicesApiError(error) ?? 'Unable to load devices' });
    }
  },

  addDevice: async (payload) => {
    set({ error: null });
    try {
      const device = await registerDevice(payload);
      set((state) => ({ devices: upsertDevice(state.devices, device) }));
      return device;
    } catch (error) {
      const message = isDevicesApiError(error) ?? 'Unable to add device';
      set({ error: message });
      throw new Error(message);
    }
  },

  refreshDevice: async (deviceId) => {
    try {
      const device = await getDevice(deviceId);
      set((state) => ({ devices: upsertDevice(state.devices, device) }));
    } catch (error) {
      set({ error: isDevicesApiError(error) ?? 'Unable to refresh device' });
    }
  },

  patchDevice: async (deviceId, patch) => {
    try {
      const device = await apiUpdateDevice(deviceId, patch);
      set((state) => ({ devices: upsertDevice(state.devices, device) }));
    } catch (error) {
      const message = isDevicesApiError(error) ?? 'Unable to update device';
      set({ error: message });
      throw new Error(message);
    }
  },

  removeDevice: async (deviceId) => {
    try {
      await apiDeleteDevice(deviceId);
      set((state) => ({
        devices: state.devices.filter((device) => device.deviceId !== deviceId),
      }));
    } catch (error) {
      const message = isDevicesApiError(error) ?? 'Unable to delete device';
      set({ error: message });
      throw new Error(message);
    }
  },

  toggleLostMode: async (deviceId, active) => {
    try {
      const device = await apiSetLostMode(deviceId, active);
      set((state) => ({ devices: upsertDevice(state.devices, device) }));
    } catch (error) {
      const message = isDevicesApiError(error) ?? 'Unable to update Lost Mode';
      set({ error: message });
      throw new Error(message);
    }
  },

  toggleRcCoreConsent: async (deviceId, consent) => {
    try {
      const device = await apiSetRcCoreConsent(deviceId, consent);
      set((state) => ({ devices: upsertDevice(state.devices, device) }));
    } catch (error) {
      const message = isDevicesApiError(error) ?? 'Unable to update sharing preference';
      set({ error: message });
      throw new Error(message);
    }
  },

  fetchDeviceLocation: async (deviceId) => {
    set((state) => ({
      locationsLoading: { ...state.locationsLoading, [deviceId]: true },
    }));
    try {
      const location = await getDeviceLocation(deviceId);
      set((state) => ({
        locations: { ...state.locations, [deviceId]: location },
        locationsLoading: { ...state.locationsLoading, [deviceId]: false },
      }));
    } catch (error) {
      set((state) => ({
        locationsLoading: { ...state.locationsLoading, [deviceId]: false },
        error: isDevicesApiError(error) ?? 'Unable to load device location',
      }));
    }
  },

  fetchDeviceHistory: async (deviceId, params) => {
    set((state) => ({
      historyLoading: { ...state.historyLoading, [deviceId]: true },
    }));
    try {
      const events = await getDeviceHistory(deviceId, params);
      set((state) => ({
        history: { ...state.history, [deviceId]: events },
        historyLoading: { ...state.historyLoading, [deviceId]: false },
      }));
    } catch (error) {
      set((state) => ({
        historyLoading: { ...state.historyLoading, [deviceId]: false },
        error: isDevicesApiError(error) ?? 'Unable to load location history',
      }));
    }
  },

  fetchGeofences: async (deviceId) => {
    set((state) => ({
      geofencesLoading: { ...state.geofencesLoading, [deviceId]: true },
    }));
    try {
      const geofences = await listGeofences(deviceId);
      set((state) => ({
        geofences: { ...state.geofences, [deviceId]: geofences },
        geofencesLoading: { ...state.geofencesLoading, [deviceId]: false },
      }));
    } catch (error) {
      set((state) => ({
        geofencesLoading: { ...state.geofencesLoading, [deviceId]: false },
        error: isDevicesApiError(error) ?? 'Unable to load geofences',
      }));
    }
  },

  addGeofence: async (deviceId, payload) => {
    try {
      const geofence = await apiCreateGeofence(deviceId, payload);
      set((state) => ({
        geofences: {
          ...state.geofences,
          [deviceId]: [...(state.geofences[deviceId] ?? []), geofence],
        },
      }));
      return geofence;
    } catch (error) {
      const message = isDevicesApiError(error) ?? 'Unable to create geofence';
      set({ error: message });
      throw new Error(message);
    }
  },

  removeGeofence: async (deviceId, geofenceId) => {
    try {
      await apiDeleteGeofence(geofenceId);
      set((state) => ({
        geofences: {
          ...state.geofences,
          [deviceId]: (state.geofences[deviceId] ?? []).filter(
            (geofence) => geofence.geofenceId !== geofenceId,
          ),
        },
      }));
    } catch (error) {
      const message = isDevicesApiError(error) ?? 'Unable to delete geofence';
      set({ error: message });
      throw new Error(message);
    }
  },

  setEmergencyContacts: async (contacts) => {
    set({ contactsLoading: true, contactsError: null });
    try {
      const saved = await saveEmergencyContacts(contacts);
      set({ emergencyContacts: saved, contactsLoading: false });
    } catch (error) {
      const message = isDevicesApiError(error) ?? 'Unable to save emergency contacts';
      set({ contactsLoading: false, contactsError: message });
      throw new Error(message);
    }
  },

  getDeviceById: (deviceId) => get().devices.find((device) => device.deviceId === deviceId),

  clearError: () => set({ error: null }),
}));
