// Phone layout (Ton, 20 Oct 2026): the same site, and on a narrow screen
// src/phone.css takes over. Keep PHONE in step with the @media rule there.
export const PHONE = '(max-width: 760px)';
export const isPhone = () => matchMedia(PHONE).matches;

// app: #app. Sets --dock-h, the height of the bottom dock (tab bar plus legend or
// sun panel), so the scale bar and the sun dial sit just above it.
// Wires the tool bar menu button, which shows Saved, Sources and Language on a phone.
export function initPhone(app) {
  const dock = app.querySelector('.bottom-dock');
  new ResizeObserver(() => app.style.setProperty('--dock-h', dock.offsetHeight + 'px')).observe(dock);

  const tools = app.querySelector('.map-tools'),
    more = app.querySelector('#tool-more');
  const open = on => {
    tools.classList.toggle('is-open', on);
    more.setAttribute('aria-expanded', String(on));
  };
  more.onclick = () => open(!tools.classList.contains('is-open'));
  // Picking something in the menu closes it.
  for (const b of tools.querySelectorAll('.tool-in-menu')) b.addEventListener('click', () => open(false));
}
