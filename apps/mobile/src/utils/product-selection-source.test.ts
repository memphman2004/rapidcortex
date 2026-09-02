import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.join(__dirname, '../../app/index.tsx'),
  'utf8',
);

describe('product selection first paint', () => {
  it('does not set custom fontFamily (iOS draws empty glyphs until expo-font loads)', () => {
    expect(source).not.toMatch(/Typography\.fontFamily/);
    expect(source).not.toMatch(/fontFamily:/);
  });

  it('does not use a Redirect component on index (empty stack after native splash)', () => {
    expect(source).not.toMatch(/\bRedirect\b/);
  });
});
