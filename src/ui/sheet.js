import {isPhone} from './phone.js';

// Building card as a bottom sheet on a phone (Ton, 20 Oct 2026). It opens as a strip
// with the address and the four answers; drag the header up for the full card, down to
// close. A tap on the header switches between the two. On a desktop it does nothing.
// card: #building-card; close: what the card's own close button does.
export function bottomSheet(card, close) {
  let full = false,
    drag = null;
  const travel = () => card.offsetHeight; // fully open -> fully down
  // Strip height: the header and the four answers, at most half the card.
  const stripHeight = () => {
    const header = card.querySelector('.card-header'),
      keys = card.querySelector('.keys');
    const bottom = (keys ?? header)?.getBoundingClientRect().bottom ?? 0;
    const h = bottom - card.getBoundingClientRect().top + card.scrollTop + 14;
    return Math.min(Math.max(h, 96), travel() * 0.5);
  };
  const place = y => card.style.setProperty('--sheet-y', y + 'px');
  const rest = () => place(full ? 0 : travel() - stripHeight());
  const setFull = on => {
    full = on;
    card.classList.toggle('is-full', on);
    if (!on) card.scrollTop = 0;
    rest();
  };

  // Shown, or new content: open as a strip, sliding up from below.
  new MutationObserver(() => {
    if (!isPhone() || card.hidden) return;
    if (!card.classList.contains('is-sheet')) {
      card.classList.add('is-sheet', 'is-dragging');
      full = false;
      card.classList.remove('is-full');
      place(travel());
      card.offsetHeight; // apply the start position before the slide
      card.classList.remove('is-dragging');
    }
    rest();
  }).observe(card, {attributes: true, attributeFilter: ['hidden'], childList: true});
  new MutationObserver(() => {
    if (card.hidden) card.classList.remove('is-sheet', 'is-full');
  }).observe(card, {attributes: true, attributeFilter: ['hidden']});

  // Drag by the header, or anywhere on the strip (the full card scrolls instead).
  // Buttons and links keep working: the sheet only takes the finger once it moves.
  card.addEventListener('pointerdown', e => {
    if (!isPhone() || e.target.closest('button, a, summary')) return;
    const header = !!e.target.closest('.card-header');
    if (full && !header) return;
    const startY = full ? 0 : travel() - stripHeight();
    drag = {id: e.pointerId, y0: e.clientY, startY, y: startY, moved: false, t0: e.timeStamp, header};
  });
  card.addEventListener('pointermove', e => {
    if (drag?.id !== e.pointerId) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) > 6) {
      drag.moved = true;
      card.setPointerCapture(e.pointerId);
      card.classList.add('is-dragging');
    }
    if (!drag.moved) return;
    drag.y = Math.max(0, drag.startY + dy);
    place(drag.y);
  });
  const end = e => {
    if (drag?.id !== e.pointerId) return;
    const {moved, y, startY, t0, header} = drag;
    drag = null;
    card.classList.remove('is-dragging');
    if (!moved) return header ? setFull(!full) : undefined;
    const strip = travel() - stripHeight(),
      fast = (y - startY) / Math.max(1, e.timeStamp - t0); // px per ms, + is down
    if (y > strip + 60 || (!full && fast > 0.5)) {
      place(travel());
      close();
    } else setFull(fast < -0.5 || (fast <= 0.5 && y < strip / 2));
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
  // Mouse wheel or trackpad on the strip: scrolling down opens the full card.
  card.addEventListener(
    'wheel',
    e => {
      if (isPhone() && !full && card.classList.contains('is-sheet') && e.deltaY > 0) setFull(true);
    },
    {passive: true},
  );
  addEventListener('resize', () => {
    if (!card.hidden && isPhone()) rest();
  });
}
