import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.join(__dirname, '../../app/_layout.tsx'),
  'utf8',
);

describe('root layout boot theme', () => {
  it('wraps the stack in React Navigation DarkTheme so splash cannot fall through to white', () => {
    expect(source).toContain("from '@react-navigation/native'");
    expect(source).toContain('NavigationThemeProvider');
    expect(source).toContain('DarkTheme');
    expect(source).toContain('NATIVE_BOOT_BACKGROUND');
  });
});
