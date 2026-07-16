import NfcManager, { Ndef, NfcTech, type TagEvent } from 'react-native-nfc-manager';

export interface NFCWriteResult {
  success: boolean;
  bytesWritten?: number;
  tagType?: string;
  error?: NFCWriteError;
}

export type NFCWriteError =
  | 'UNSUPPORTED'
  | 'PERMISSION_DENIED'
  | 'TIMEOUT'
  | 'TAG_INCOMPATIBLE'
  | 'WRITE_FAILED'
  | 'CANCELLED';

function classifyWriteError(message: string): NFCWriteError {
  const lower = message.toLowerCase();
  if (lower.includes('cancelled') || lower.includes('usercancel')) {
    return 'CANCELLED';
  }
  if (lower.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (lower.includes('permission')) {
    return 'PERMISSION_DENIED';
  }
  if (lower.includes('ndef') || lower.includes('incompatible')) {
    return 'TAG_INCOMPATIBLE';
  }
  return 'WRITE_FAILED';
}

export async function isNFCSupported(): Promise<boolean> {
  try {
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

export async function isNFCEnabled(): Promise<boolean> {
  try {
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

export async function initializeNfc(): Promise<boolean> {
  const supported = await isNFCSupported();
  if (!supported) return false;
  await NfcManager.start();
  return true;
}

export async function writeURLToTag(url: string): Promise<NFCWriteResult> {
  let supported = false;
  try {
    supported = await NfcManager.isSupported();
  } catch {
    return { success: false, error: 'UNSUPPORTED' };
  }

  if (!supported) {
    return { success: false, error: 'UNSUPPORTED' };
  }

  try {
    await NfcManager.start();
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: 'Hold an NTAG213 tag to the back of your phone',
    });

    const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
    if (!bytes) {
      return { success: false, error: 'WRITE_FAILED' };
    }

    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    const tag: TagEvent | null = await NfcManager.getTag();

    return {
      success: true,
      bytesWritten: bytes.length,
      tagType: tag?.type ?? 'NDEF',
    };
  } catch (ex: unknown) {
    const msg = ex instanceof Error ? ex.message : String(ex);
    return { success: false, error: classifyWriteError(msg) };
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

export async function cancelNfcSession(): Promise<void> {
  await NfcManager.cancelTechnologyRequest().catch(() => undefined);
}

export function nfcErrorMessage(error: NFCWriteError): string {
  switch (error) {
    case 'UNSUPPORTED':
      return 'This device does not support NFC programming.';
    case 'PERMISSION_DENIED':
      return 'NFC permission was denied. Enable NFC in Settings.';
    case 'TIMEOUT':
      return 'No NFC tag detected. Hold the tag closer and try again.';
    case 'TAG_INCOMPATIBLE':
      return 'This tag is not NDEF writable. Use an NTAG213 tag.';
    case 'CANCELLED':
      return 'NFC write cancelled.';
    case 'WRITE_FAILED':
    default:
      return 'NFC write failed. Try again with a different tag.';
  }
}
