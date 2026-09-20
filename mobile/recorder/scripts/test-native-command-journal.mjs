// Standalone Swift/SQLite unit tests, not an app archive. Run on a Mac with swiftc.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'journeydeck-journal-test-'));
try {
  const source = readFileSync(join(root, 'modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift'), 'utf8');
  const start = source.indexOf('enum NativeRecorderError:');
  const end = source.indexOf('final class JourneyDeckNativeRecorder:');
  if (start < 0 || end <= start) throw new Error('Could not extract the production database implementation');
  const constants = source.match(/private let nativeInbox(?:ApplicationID|SchemaVersion):[^\r\n]+/g);
  if (constants?.length !== 2) throw new Error('Missing production schema constants');
  const database = join(directory, 'NativeDatabase.swift');
  writeFileSync(database, `import Foundation\nimport SQLite3\n${constants.join('\n')}\n${source.slice(start, end)}`);
  for (const harness of ['RecorderCommandJournalTests', 'RecorderStateMachineTests']) {
    const binary = join(directory, harness);
    const compiled = spawnSync('swiftc', [database,
      join(root, 'modules/journeydeck-recorder/ios/RecorderStateMachine.swift'),
      join(root, 'modules/journeydeck-recorder/ios/RecorderCommandJournal.swift'),
      join(root, `tests/swift/${harness}.swift`), '-o', binary], { stdio: 'inherit' });
    if (compiled.error) throw new Error('Swift compiler unavailable. Run this test on macOS with Xcode command-line tools.');
    const status = compiled.status === 0
      ? spawnSync(binary, [], { stdio: 'inherit' }).status ?? 1 : compiled.status ?? 1;
    if (status !== 0) { process.exitCode = status; break; }
  }
} finally {
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected test directory');
  rmSync(directory, { recursive: true, force: true });
}
