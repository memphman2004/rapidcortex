import { beforeEach, describe, expect, it, vi } from 'vitest';

const getItem = vi.fn();
const setItem = vi.fn();
const removeItem = vi.fn();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem,
    setItem,
    removeItem,
  },
}));

describe('splash enter persistence', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    vi.resetModules();
  });

  it('treats storage read failures as not entered', async () => {
    getItem.mockRejectedValue(new Error('native module missing'));
    const { hasEnteredCortexRecently } = await import('./splash');
    await expect(hasEnteredCortexRecently()).resolves.toBe(false);
  });

  it('does not throw when markCortexEntered cannot write', async () => {
    setItem.mockRejectedValue(new Error('native module missing'));
    const { markCortexEntered } = await import('./splash');
    await expect(markCortexEntered()).resolves.toBeUndefined();
  });
});
