/**
 * Xcode 26 / Apple Clang rejects fmt consteval in React Native's bundled fmt.
 * Inject a Podfile post_install hook used by EAS prebuild (managed workflow).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'Xcode 26 fmt workaround';

const HOOK = `
  # ${MARKER}: disable fmt consteval / force C++17 for fmt target
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
  end
  fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
  if File.exist?(fmt_base)
    content = File.read(fmt_base)
    unless content.include?('Xcode 26 workaround')
      patched = content.gsub(
        /^(#elif defined\\(__cpp_consteval\\)\\n#  define FMT_USE_CONSTEVAL) 1/,
        "// Xcode 26 workaround: disable consteval\\n\\\\1 0"
      )
      if patched != content
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
      end
    end
  end
`;

function withXcode26FmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) {
        return cfg;
      }

      // Insert at the start of the existing post_install block (Expo/RN always adds one).
      if (/post_install do \|installer\|/.test(contents)) {
        contents = contents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${HOOK}`,
        );
      } else {
        contents += `\npost_install do |installer|${HOOK}\nend\n`;
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
}

module.exports = withXcode26FmtFix;
