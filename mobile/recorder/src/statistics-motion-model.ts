/** Exact vertices, padded with the last point so every range has the same topology.
 * Padding (rather than resampling) preserves every peak and zero at rest. */
export function statisticsSparkline(values: readonly number[]) {
  const series = values.slice(-90).map(n => Number.isFinite(n) ? Math.max(0, n) : 0);
  const max = Math.max(1, ...series);
  const points = series.map((n, i) => [i / Math.max(1, series.length - 1) * 160, 28 - n / max * 25]);
  if (!points.length) points.push([0, 28], [160, 28]);
  if (points.length === 1) points.push([160, points[0][1]]);
  while (points.length < 90) points.push(points[points.length - 1]);
  return points.flat();
}

export function statisticsPointsString(points: number[]) {
  'worklet';
  let result = '';
  for (let i = 0; i < points.length; i += 2) result += `${i ? ' ' : ''}${points[i]},${points[i + 1]}`;
  return result;
}

export function statisticsFraction(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
