// Smooth colour scales: a list of colours read evenly from left to right.
// colorAt(colors, t) gives the colour at t (0 = first, 1 = last) as #rrggbb.
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export function colorAt(colors, t) {
  const x = Math.min(1, Math.max(0, t)) * (colors.length - 1),
    i = Math.min(colors.length - 2, Math.floor(x)),
    f = x - i;
  const a = rgb(colors[i]),
    b = rgb(colors[i + 1]);
  return (
    '#' +
    a
      .map((v, k) =>
        Math.round(v + (b[k] - v) * f)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
