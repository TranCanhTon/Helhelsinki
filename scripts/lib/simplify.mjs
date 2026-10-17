// Douglas-Peucker on [lon, lat] points with a tolerance in metres.
// Used for route shapes (data:transit) and parking zone outlines (data:parking).
export function simplify(points, toleranceM) {
  if (points.length < 3) return points;
  const kx = 111320 * Math.cos((points[0][1] * Math.PI) / 180),
    ky = 110540;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = [points[a][0] * kx, points[a][1] * ky],
      [bx, by] = [points[b][0] * kx, points[b][1] * ky];
    const dx = bx - ax,
      dy = by - ay,
      length2 = dx * dx + dy * dy;
    let worst = -1,
      worstD = toleranceM;
    for (let i = a + 1; i < b; i++) {
      const px = points[i][0] * kx - ax,
        py = points[i][1] * ky - ay;
      const t = length2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / length2)) : 0;
      const d = Math.hypot(px - t * dx, py - t * dy);
      if (d > worstD) {
        worst = i;
        worstD = d;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
