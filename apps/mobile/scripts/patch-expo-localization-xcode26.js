/**
 * Xcode 26 / iOS 26 adds Calendar.Identifier cases that Expo SDK 52's
 * expo-localization switch does not cover ("switch must be exhaustive").
 */
const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-localization',
  'ios',
  'LocalizationModule.swift',
);

const MARKER = '@unknown default:';
const NEEDLE = `    case .iso8601:
      return "iso8601"
    }
`;
const REPLACEMENT = `    case .iso8601:
      return "iso8601"
    ${MARKER}
      return "iso8601"
    }
`;

function patch() {
  if (!fs.existsSync(filePath)) {
    console.log('[xcode26] expo-localization Swift file missing; skip');
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(MARKER)) {
    console.log('[xcode26] LocalizationModule.swift already patched');
    return;
  }
  if (!content.includes(NEEDLE)) {
    console.warn('[xcode26] LocalizationModule.swift pattern not found; skip');
    return;
  }
  fs.writeFileSync(filePath, content.replace(NEEDLE, REPLACEMENT));
  console.log('[xcode26] Patched LocalizationModule.swift for iOS 26 calendars');
}

patch();
