import AsyncStorage from '@react-native-async-storage/async-storage';

const ENTER_KEY = 'rc_mobile_cortex_entered_at';
/** Matches marketing cookie max-age=86400 (24 hours). */
const ENTER_TTL_MS = 24 * 60 * 60 * 1000;

export async function hasEnteredCortexRecently(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ENTER_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < ENTER_TTL_MS;
  } catch {
    return false;
  }
}

export async function markCortexEntered(): Promise<void> {
  await AsyncStorage.setItem(ENTER_KEY, String(Date.now()));
}

export async function clearCortexEntered(): Promise<void> {
  await AsyncStorage.removeItem(ENTER_KEY);
}
