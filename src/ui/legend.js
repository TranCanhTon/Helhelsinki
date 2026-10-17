// Legends under the view bar.
const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};

// A smooth colour bar with only its two ends marked, as Ton asked (13 Oct 2026).
// title: what the colours mean, with the unit ("Sale price · €/m²").
// missing: {color, text} adds a key for buildings or areas without data.
export function legendGradient(container, {colors, start, end, title, missing}) {
  container.replaceChildren();
  container.classList.remove('is-keys');
  container.classList.add('is-gradient');
  const bar = el('span', 'legend-gradient');
  bar.style.background = `linear-gradient(90deg, ${colors.join(', ')})`;
  if (title) container.append(el('span', 'legend-title', title));
  container.append(el('span', 'legend-end', start), bar, el('span', 'legend-end', end));
  if (missing) {
    const key = el('span', 'legend-missing'),
      swatch = el('i');
    swatch.style.background = missing.color;
    key.append(swatch, document.createTextNode(missing.text));
    container.append(key);
  }
}

// Legend for groups or types: a swatch and a name for each, then an optional note.
// items: [{color, text, square}]
export function legendKeys(container, {title, items, note}) {
  container.replaceChildren();
  container.classList.remove('is-gradient');
  container.classList.add('is-keys');
  const keys = el('div', 'legend-keys');
  for (const item of items) {
    const key = el('span', 'legend-key'),
      swatch = el('i', item.square ? 'is-square' : null);
    swatch.style.background = item.color;
    key.append(swatch, document.createTextNode(item.text));
    keys.append(key);
  }
  if (title) {
    const head = el('div', 'legend-head');
    head.append(el('strong', null, title));
    container.append(head);
  }
  container.append(keys);
  if (note) container.append(el('span', 'legend-note', note));
}
