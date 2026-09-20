import test from "node:test";
import assert from "node:assert/strict";
import { clampAngle, closestPosture, layoutMetrics, panelRotations, POSTURES, screenPresentation, usesTabletCanvas } from "./dist/model.js";

test("posture presets stay inside the physical fold range", () => {
  for (const posture of Object.values(POSTURES)) {
    assert.equal(clampAngle(posture.angle), posture.angle);
  }
});

test("fold angle is rounded and safely clamped", () => {
  assert.equal(clampAngle(-10), 0);
  assert.equal(clampAngle(93.6), 94);
  assert.equal(clampAngle(220), 180);
  assert.equal(clampAngle("invalid"), POSTURES.book.angle);
});

test("layout metrics switch from one to two display regions", () => {
  assert.deepEqual(layoutMetrics(0), {
    angle: 0, panes: 1, division: "none", presentation: "compact", reservedRegion: 0
  });
  assert.deepEqual(layoutMetrics(118), {
    angle: 118, panes: 2, division: "vertical", presentation: "expanded book", reservedRegion: 22
  });
  assert.equal(layoutMetrics(180).presentation, "expanded flat");
});

test("custom folds report their nearest named posture", () => {
  assert.equal(closestPosture(176), "flat");
  assert.equal(closestPosture(112), "book");
  assert.equal(closestPosture(4), "closed");
});

test("open-book rotations turn both displays toward the inside of the fold", () => {
  const book = panelRotations(118);
  assert.ok(book.leftRadians > 0);
  assert.ok(book.rightRadians < 0);
  assert.equal(book.leftRadians, -book.rightRadians);
  assert.deepEqual(panelRotations(180), { leftRadians: 0, rightRadians: -0 });
});

test("tent rotates the physical device into landscape", () => {
  assert.equal(POSTURES.tent.orientation, "landscape");
  assert.equal(POSTURES.tent.rotationZ, Math.PI / 2);
  assert.equal(POSTURES.book.rotationZ, 0);
});

test("only the fully open range uses the continuous tablet canvas", () => {
  assert.equal(usesTabletCanvas(167), false);
  assert.equal(usesTabletCanvas(168), true);
  assert.equal(usesTabletCanvas(180), true);
});

test("screen presentation separates landscape, portrait, and tent interfaces", () => {
  assert.equal(screenPresentation("flat", 180), "tablet");
  assert.equal(screenPresentation("flatPortrait", 180), "duo portrait");
  assert.equal(screenPresentation("tent", 58), "duo tent");
  assert.equal(screenPresentation("book", 118), "independent");
});
