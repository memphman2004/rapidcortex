import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  type Characteristic,
  type Device,
  type Subscription,
} from 'react-native-ble-plx';

/** Advertised service UUID for Safe & Sound Home devices. */
export const RC_SAFE_SOUND_HOME_SERVICE_UUID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

/** GATT characteristics for ownership handshake. */
export const RC_DEVICE_ID_CHARACTERISTIC_UUID =
  'b1c2d3e4-f5a6-4789-bcde-f12345678901';
export const RC_OWNER_TOKEN_CHARACTERISTIC_UUID =
  'b1c2d3e4-f5a6-4789-bcde-f12345678902';

const SCAN_TIMEOUT_MS = 30_000;
const HOME_DEVICE_NAME_PREFIX = 'RC Safe';

export type BLEPermissionStatus = 'granted' | 'denied' | 'unavailable';

export interface DiscoveredBleDevice {
  id: string;
  name: string;
  rssi: number | null;
  serviceUuids: string[] | null;
}

export interface BlePairResult {
  success: boolean;
  deviceId?: string;
  error?: BleError;
}

export type BleError =
  | 'PERMISSION_DENIED'
  | 'BLUETOOTH_OFF'
  | 'SCAN_TIMEOUT'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'PAIRING_FAILED'
  | 'OUT_OF_RANGE';

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (!manager) {
    manager = new BleManager();
  }
  return manager;
}

function normalizeServiceUuid(uuid: string): string {
  return uuid.toLowerCase();
}

function isHomeDevice(device: Device): boolean {
  const name = device.name ?? device.localName ?? '';
  const serviceUuids = device.serviceUUIDs ?? [];
  const hasService = serviceUuids.some(
    (uuid) => normalizeServiceUuid(uuid) === RC_SAFE_SOUND_HOME_SERVICE_UUID,
  );
  const hasName = name.toUpperCase().includes(HOME_DEVICE_NAME_PREFIX.toUpperCase());
  return hasService || hasName;
}

export async function requestBlePermissions(): Promise<BLEPermissionStatus> {
  if (Platform.OS === 'ios') {
    const state = await getManager().state();
    if (state === 'PoweredOff') return 'unavailable';
    return 'granted';
  }

  if (Platform.OS !== 'android') {
    return 'unavailable';
  }

  const apiLevel = Platform.Version;
  if (typeof apiLevel === 'number' && apiLevel >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);

    const granted = Object.values(results).every(
      (result) => result === PermissionsAndroid.RESULTS.GRANTED,
    );
    return granted ? 'granted' : 'denied';
  }

  const location = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return location === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
}

export async function isBluetoothReady(): Promise<boolean> {
  const state = await getManager().state();
  return state === 'PoweredOn';
}

export async function scanForHomeDevices(
  onDeviceFound?: (device: DiscoveredBleDevice) => void,
): Promise<DiscoveredBleDevice[]> {
  const permission = await requestBlePermissions();
  if (permission !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }

  const ready = await isBluetoothReady();
  if (!ready) {
    throw new Error('BLUETOOTH_OFF');
  }

  const discovered = new Map<string, DiscoveredBleDevice>();

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      bleManagerStopScan();
      if (discovered.size === 0) {
        reject(new Error('SCAN_TIMEOUT'));
      } else {
        resolve();
      }
    }, SCAN_TIMEOUT_MS);

    getManager().startDeviceScan(
      [RC_SAFE_SOUND_HOME_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          clearTimeout(timeout);
          bleManagerStopScan();
          reject(error);
          return;
        }

        if (!device || !isHomeDevice(device)) return;

        const entry: DiscoveredBleDevice = {
          id: device.id,
          name: device.name ?? device.localName ?? 'RC Safe & Sound Home',
          rssi: device.rssi,
          serviceUuids: device.serviceUUIDs,
        };

        discovered.set(device.id, entry);
        onDeviceFound?.(entry);
      },
    );
  });

  return [...discovered.values()];
}

export function bleManagerStopScan(): void {
  getManager().stopDeviceScan();
}

function utf8ToBase64(value: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(unescape(encodeURIComponent(value)));
  }
  throw new Error('Base64 encoding unavailable in this runtime');
}

async function writeCharacteristic(
  device: Device,
  serviceUuid: string,
  characteristicUuid: string,
  value: string,
): Promise<void> {
  const services = await device.services();
  const service = services.find(
    (entry) => normalizeServiceUuid(entry.uuid) === normalizeServiceUuid(serviceUuid),
  );
  if (!service) {
    throw new Error('PAIRING_FAILED');
  }

  const characteristics: Characteristic[] = await service.characteristics();
  const characteristic = characteristics.find(
    (entry) =>
      normalizeServiceUuid(entry.uuid) === normalizeServiceUuid(characteristicUuid),
  );
  if (!characteristic) {
    throw new Error('PAIRING_FAILED');
  }

  const encoded = utf8ToBase64(value);
  await characteristic.writeWithResponse(encoded);
}

export async function pairHomeDevice(params: {
  bleDeviceId: string;
  rcDeviceId: string;
  ownerToken: string;
}): Promise<BlePairResult> {
  try {
    const permission = await requestBlePermissions();
    if (permission !== 'granted') {
      return { success: false, error: 'PERMISSION_DENIED' };
    }

    const device = await getManager().connectToDevice(params.bleDeviceId, {
      timeout: 15_000,
    });
    await device.discoverAllServicesAndCharacteristics();

    await writeCharacteristic(
      device,
      RC_SAFE_SOUND_HOME_SERVICE_UUID,
      RC_DEVICE_ID_CHARACTERISTIC_UUID,
      params.rcDeviceId,
    );
    await writeCharacteristic(
      device,
      RC_SAFE_SOUND_HOME_SERVICE_UUID,
      RC_OWNER_TOKEN_CHARACTERISTIC_UUID,
      params.ownerToken,
    );

    await device.cancelConnection();
    return { success: true, deviceId: params.rcDeviceId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('SCAN_TIMEOUT')) {
      return { success: false, error: 'SCAN_TIMEOUT' };
    }
    if (message.includes('PERMISSION_DENIED')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
    if (message.includes('Device is not connected')) {
      return { success: false, error: 'OUT_OF_RANGE' };
    }
    if (message.includes('Connection')) {
      return { success: false, error: 'CONNECTION_FAILED' };
    }
    return { success: false, error: 'PAIRING_FAILED' };
  }
}

export function monitorHomeDevice(
  bleDeviceId: string,
  onDisconnect?: () => void,
): Subscription {
  return getManager().onDeviceDisconnected(bleDeviceId, () => {
    onDisconnect?.();
  });
}

export function destroyBleManager(): void {
  bleManagerStopScan();
  manager?.destroy();
  manager = null;
}

export function bleErrorMessage(error: BleError): string {
  switch (error) {
    case 'PERMISSION_DENIED':
      return 'Bluetooth permission is required to pair your device.';
    case 'BLUETOOTH_OFF':
      return 'Turn on Bluetooth to continue.';
    case 'SCAN_TIMEOUT':
      return 'Device not found. Press the button on your Home device and try again.';
    case 'DEVICE_NOT_FOUND':
      return 'No Safe & Sound Home device was detected nearby.';
    case 'CONNECTION_FAILED':
      return 'Could not connect to the device. Move closer and retry.';
    case 'OUT_OF_RANGE':
      return 'Device is out of range.';
    case 'PAIRING_FAILED':
    default:
      return 'Pairing failed. Try again.';
  }
}
