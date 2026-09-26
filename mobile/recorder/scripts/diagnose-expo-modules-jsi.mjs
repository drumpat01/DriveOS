import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (['v3-testflight', 'v4-testflight'].includes(process.env.EAS_BUILD_PROFILE)) {
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  const scriptPath = join(projectRoot, 'node_modules', 'expo-modules-jsi', 'apple', 'scripts', 'build-xcframework.sh');
  const source = readFileSync(scriptPath, 'utf8');
  const quietFlag = /^    -quiet \\\r?\n/gm;
  const matches = [...source.matchAll(quietFlag)];

  if (matches.length !== 1) {
    throw new Error(`Expected one ExpoModulesJSI nested xcodebuild -quiet flag, found ${matches.length}`);
  }

  writeFileSync(scriptPath, source.replace(quietFlag, ''));
  console.log('ExpoModulesJSI nested xcodebuild will emit full diagnostics for TestFlight.');
}
