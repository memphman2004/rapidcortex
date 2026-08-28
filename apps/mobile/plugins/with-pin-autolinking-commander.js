/**
 * Re-apply the commander 7.x nest during prebuild so Xcode's
 * "[Expo] Configure project" cannot pick up a hoisted commander 12.
 */
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');
const {
  pinCommanderUnderExpoAutolinking,
} = require('../scripts/pin-expo-autolinking-commander.js');

function withPinAutolinkingCommander(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      pinCommanderUnderExpoAutolinking({
        mobileRoot: projectRoot,
        workspaceRoot: path.resolve(projectRoot, '../..'),
        installIfMissing: true,
      });
      return cfg;
    },
  ]);
}

module.exports = withPinAutolinkingCommander;
