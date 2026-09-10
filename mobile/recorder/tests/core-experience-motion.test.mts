import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { deriveLiveMotionMetrics, JourneyCardEntryTracker } from '../src/core-experience-motion.ts';

test('live metrics derive only from real timestamps and GPS points', () => {
  const metrics = deriveLiveMotionMetrics({
    startedAt: '2026-09-08T12:00:00.000Z',
    now: Date.parse('2026-09-08T12:01:05.000Z'),
    points: [
      { latitude: 43, longitude: -83, speedMps: 4, accuracyMeters: 12 },
      { latitude: 43.01449, longitude: -83, speedMps: 10, accuracyMeters: 22 },
    ],
  });
  assert.equal(metrics.elapsedSeconds, 65);
  assert.ok(Math.abs(metrics.distanceMiles - 1) < 0.02);
  assert.ok(Math.abs(metrics.speedMph - 22.3694) < 0.001);
  assert.deepEqual(metrics.gps, { label: 'Good', level: 'good' });
});

test('journey entry registry presents a card only once per session', () => {
  const tracker = new JourneyCardEntryTracker();
  assert.equal(tracker.shouldAnimate('journey-1'), true);
  assert.equal(tracker.shouldAnimate('journey-1'), false);
  assert.equal(tracker.shouldAnimate('journey-2'), true);
});

test('core motion uses shared lifecycle and semantic haptics', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const live = readFileSync(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');
  const cards = readFileSync(new URL('../src/card-detail-link.tsx', import.meta.url), 'utf8');
  assert.match(app, /if \(!isAppActive\) return/);
  assert.match(app, /completeSessionLocally[\s\S]*haptics\.success/);
  assert.match(app, /home-start-journey-portal[\s\S]*onPressIn=\{pressIn\}/);
  assert.match(live, /deriveLiveMotionMetrics/);
  assert.match(live, /if \(!motion\.active\) return/);
  assert.match(cards, /useMotionPreferences/);
  assert.match(cards, /usePreventZoomTransitionDismissal/);
});
