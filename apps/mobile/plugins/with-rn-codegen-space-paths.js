/**
 * After pod install, quote Xcode script phases so a project path that contains
 * spaces does not split in /bin/sh -c or bash -l -c.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'RAPID_CORTEX_RN_CODEGEN_SPACE_PATHS';
const EX_MARKER = 'RAPID_CORTEX_EXCONSTANTS_SPACE_PATHS';

const HOOK = `
  # ${MARKER}: quote RN codegen scripts (paths with spaces break /bin/sh -c)
  installer.pods_project.targets.each do |target|
    target.shell_script_build_phases.each do |phase|
      next unless phase.shell_script.include?('/bin/sh -c "$WITH_ENVIRONMENT $SCRIPT_PHASES_SCRIPT"')
      phase.shell_script = phase.shell_script.gsub(
        '/bin/sh -c "$WITH_ENVIRONMENT $SCRIPT_PHASES_SCRIPT"',
        '/bin/bash "$WITH_ENVIRONMENT" "$SCRIPT_PHASES_SCRIPT"'
      )
    end
  end
`;

const EX_HOOK = `
  # ${EX_MARKER}: quote EXConstants get-app-config (bash -c splits on spaces)
  installer.pods_project.targets.each do |target|
    target.shell_script_build_phases.each do |phase|
      next unless phase.shell_script.include?('bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"')
      phase.shell_script = phase.shell_script.gsub(
        'bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"',
        'bash -l "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"'
      )
    end
  end
`;

/**
 * @param {string} contents
 * @param {string} marker
 * @param {string} hook
 */
function injectPostInstallHook(contents, marker, hook) {
  if (contents.includes(marker)) {
    return contents;
  }
  if (/post_install do \|installer\|/.test(contents)) {
    return contents.replace(
      /post_install do \|installer\|/,
      `post_install do |installer|${hook}`,
    );
  }
  return `${contents}\npost_install do |installer|${hook}\nend\n`;
}

function withRnCodegenSpacePaths(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      contents = injectPostInstallHook(contents, MARKER, HOOK);
      contents = injectPostInstallHook(contents, EX_MARKER, EX_HOOK);
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
}

module.exports = withRnCodegenSpacePaths;
