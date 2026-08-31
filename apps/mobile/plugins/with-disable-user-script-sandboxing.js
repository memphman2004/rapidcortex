/**
 * Xcode 15+ defaults ENABLE_USER_SCRIPT_SANDBOXING=YES. Expo's
 * "[Expo] Configure project" phase then cannot read
 * Pods/Target Support Files/.../expo-configure-project.sh
 * (deny file-read-data), especially when the repo lives on an
 * external volume with spaces in the path.
 */
const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'RAPID_CORTEX_DISABLE_USER_SCRIPT_SANDBOXING';
const UNQUOTED = 'ENABLE_USER_SCRIPT_SANDBOXING = YES;';
const QUOTED = 'ENABLE_USER_SCRIPT_SANDBOXING = NO;';

const HOOK = `
  # ${MARKER}: Expo configure script cannot read Pods/Target Support Files
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |bc|
      bc.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
  installer.aggregate_targets.each do |aggregate|
    aggregate.user_project.native_targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
      end
    end
    aggregate.user_project.build_configurations.each do |bc|
      bc.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
    aggregate.user_project.save
  end
`;

/**
 * @param {string} contents
 * @returns {{ contents: string, changed: boolean }}
 */
function patchUserScriptSandboxing(contents) {
  if (!contents.includes(UNQUOTED)) {
    return { contents, changed: false };
  }
  return {
    contents: contents.split(UNQUOTED).join(QUOTED),
    changed: true,
  };
}

function withDisableUserScriptSandboxing(config) {
  const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');

  config = withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key]?.buildSettings;
      if (!settings) continue;
      settings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
    }
    return cfg;
  });

  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes(MARKER)) {
        if (/post_install do \|installer\|/.test(contents)) {
          contents = contents.replace(
            /post_install do \|installer\|/,
            `post_install do |installer|${HOOK}`,
          );
        } else {
          contents += `\npost_install do |installer|${HOOK}\nend\n`;
        }
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
}

module.exports = withDisableUserScriptSandboxing;
module.exports.patchUserScriptSandboxing = patchUserScriptSandboxing;
module.exports.UNQUOTED = UNQUOTED;
module.exports.QUOTED = QUOTED;
