import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Xcode 27 fails ExpoModulesJSI SwiftCompile when the nested xcodebuild uses
// -quiet: "the following command failed with exit code 0 but produced no
// further output" (expo/expo#50311). Removing that flag is what let build 51
// succeed on macos-tahoe-26.6-xcode-27.0. production uses that same image.
export const EXPO_MODULES_JSI_DIAGNOSTIC_PROFILES = ['v3-testflight', 'v4-testflight', 'production'];

if (EXPO_MODULES_JSI_DIAGNOSTIC_PROFILES.includes(process.env.EAS_BUILD_PROFILE)) {
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  const scriptPath = join(projectRoot, 'node_modules', 'expo-modules-jsi', 'apple', 'scripts', 'build-xcframework.sh');
  const source = readFileSync(scriptPath, 'utf8');
  const quietFlag = /^    -quiet \\\r?\n/gm;
  const matches = [...source.matchAll(quietFlag)];

  if (matches.length !== 1) {
    throw new Error(`Expected one ExpoModulesJSI nested xcodebuild -quiet flag, found ${matches.length}`);
  }

  writeFileSync(scriptPath, source.replace(quietFlag, ''));
  console.log(`ExpoModulesJSI nested xcodebuild will emit full diagnostics for ${process.env.EAS_BUILD_PROFILE}.`);
}
