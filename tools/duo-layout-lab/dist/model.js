export const POSTURES = Object.freeze({
  closed: Object.freeze({ label: "Closed", angle: 0, orientation: "portrait", rotationZ: 0, camera: "front" }),
  book: Object.freeze({ label: "Open book", angle: 118, orientation: "portrait", rotationZ: 0, camera: "perspective" }),
  flat: Object.freeze({ label: "Flat landscape", angle: 180, orientation: "landscape", rotationZ: 0, camera: "front" }),
  flatPortrait: Object.freeze({ label: "Flat portrait", angle: 180, orientation: "portrait", rotationZ: 0, camera: "front" }),
  flex: Object.freeze({ label: "Flex mode", angle: 92, orientation: "portrait", rotationZ: 0, camera: "high" }),
  tent: Object.freeze({ label: "Tent", angle: 58, orientation: "landscape", rotationZ: Math.PI / 2, camera: "perspective" })
});

export function clampAngle(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return POSTURES.book.angle;
  return Math.min(180, Math.max(0, Math.round(parsed)));
}

export function closestPosture(angle) {
  const safeAngle = clampAngle(angle);
  return Object.entries(POSTURES).reduce((closest, entry) => {
    const distance = Math.abs(entry[1].angle - safeAngle);
    return distance < closest.distance ? { key: entry[0], distance } : closest;
  }, { key: "book", distance: Number.POSITIVE_INFINITY }).key;
}

export function layoutMetrics(angle) {
  const safeAngle = clampAngle(angle);
  const closed = safeAngle <= 12;
  const flat = safeAngle >= 168;
  return Object.freeze({
    angle: safeAngle,
    panes: closed ? 1 : 2,
    division: closed ? "none" : "vertical",
    presentation: closed ? "compact" : flat ? "expanded flat" : "expanded book",
    reservedRegion: closed ? 0 : 22
  });
}

export function panelRotations(angle) {
  const halfFold = ((180 - clampAngle(angle)) / 2) * (Math.PI / 180);
  return Object.freeze({
    leftRadians: halfFold,
    rightRadians: -halfFold
  });
}

export function usesTabletCanvas(angle) {
  return clampAngle(angle) >= 168;
}

export function screenPresentation(postureKey, angle) {
  const safeAngle = clampAngle(angle);
  if (postureKey === "tent") return "duo tent";
  if (safeAngle >= 168 && postureKey === "flatPortrait") return "duo portrait";
  if (safeAngle >= 168 && postureKey === "flat") return "tablet";
  return "independent";
}
