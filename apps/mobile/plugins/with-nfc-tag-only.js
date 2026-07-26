/**
 * Force NFC entitlement to TAG-only.
 * Apple ITMS-90778 rejects NDEF in com.apple.developer.nfc.readersession.formats
 * for current App Store SDK rules. NDEF read/write still works with TAG.
 */
const { withEntitlementsPlist } = require('@expo/config-plugins');

const NFC_FORMATS_KEY = 'com.apple.developer.nfc.readersession.formats';

function withNfcTagOnly(config) {
  return withEntitlementsPlist(config, (cfg) => {
    cfg.modResults[NFC_FORMATS_KEY] = ['TAG'];
    return cfg;
  });
}

module.exports = withNfcTagOnly;
