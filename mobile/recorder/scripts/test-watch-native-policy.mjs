import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'journeydeck-watch-policy-'));
try {
  const binary = join(directory, process.platform === 'win32' ? 'policy-tests.exe' : 'policy-tests');
  const compiler = spawnSync('swiftc', [
    join(root, 'modules/journeydeck-recorder/ios/ManualJourneyInactivity.swift'),
    join(root, 'tests/swift/ManualJourneyInactivityTests.swift'), '-o', binary,
  ], { stdio: 'inherit' });
  if (compiler.error) {
    throw new Error('Swift compiler unavailable. Run this check on macOS with Xcode command-line tools, or a Swift toolchain.');
  }
  if (compiler.status !== 0) process.exitCode = compiler.status ?? 1;
  else process.exitCode = spawnSync(binary, [], { stdio: 'inherit' }).status ?? 1;
} finally {
  const target = resolve(directory);
  if (!target.startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected test output directory.');
  rmSync(target, { recursive: true, force: true });
}
